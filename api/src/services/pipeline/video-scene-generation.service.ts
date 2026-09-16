import { randomUUID } from "node:crypto";
import type { Scene } from "../../schema/video-spec.schema";
import type { BudgetReservation } from "./budget-policy.service";
import { MAX_PROVIDER_ATTEMPTS_PER_CALL, providerCallBudget } from "./budget-policy.service";
import type { ProviderBudgetContext } from "./provider-budget.service";

export type VideoSceneJobState = {
  fingerprint: string;
  attemptNumber: number;
  providerAttemptId: string;
  reservationKey: string;
  requestedSeconds: number;
  status: "submitting" | "submitted" | "provider_completed" | "completed" | "failed";
  providerJobId?: string;
  artifactKey?: string;
  error?: string;
};

export interface VideoSceneStateStore {
  load(): Promise<VideoSceneJobState | null>;
  save(state: VideoSceneJobState): Promise<void>;
  restoreCompleted(state: VideoSceneJobState): Promise<string | null>;
  persistCompleted(localPath: string, state: VideoSceneJobState): Promise<string>;
}

export interface VideoSceneProvider {
  submit(scene: Scene, model: string): Promise<string>;
  waitForCompletion(providerJobId: string): Promise<void>;
  materialize(providerJobId: string): Promise<string>;
}

export interface VideoSceneUsageLedger {
  begin(input: {
    attemptId: string;
    attemptNumber: number;
    requestedSeconds: number;
  }): Promise<void>;
  cancelBeforeStart(input: { attemptId: string; error: string }): Promise<void>;
  succeed(input: { attemptId: string; generatedSeconds: number }): Promise<void>;
  fail(input: { attemptId: string; error: string }): Promise<void>;
}

export class ProviderJobFailedError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "ProviderJobFailedError";
  }
}

export class ProviderSubmissionUncertainError extends Error {
  constructor() {
    super(
      "Video provider submission may have been accepted before its job ID was persisted; automatic resubmission is blocked to prevent duplicate spend",
    );
    this.name = "ProviderSubmissionUncertainError";
  }
}

function errorMessage(error: unknown): string {
  return error instanceof Error ? error.message : String(error);
}

function nextAttemptNumber(state: VideoSceneJobState | null): number {
  if (!state || state.status !== "failed") return 1;
  return state.attemptNumber + 1;
}

/**
 * Runs one paid scene job. State is persisted before submission and immediately
 * after receiving the provider job ID. If the process dies between those two
 * writes, replay stops for reconciliation instead of risking a duplicate call.
 */
export async function generateVideoScene(input: {
  scene: Scene;
  model: string;
  fingerprint: string;
  budget: ProviderBudgetContext;
  store: VideoSceneStateStore;
  provider: VideoSceneProvider;
  usage: VideoSceneUsageLedger;
  lease?: { assertOwned(): Promise<void> };
}): Promise<string> {
  let state = await input.store.load();
  if (state && state.fingerprint !== input.fingerprint) state = null;

  if (state?.status === "completed") {
    await input.lease?.assertOwned();
    const restored = await input.store.restoreCompleted(state);
    if (restored) return restored;
    if (!state.providerJobId) throw new Error("Completed scene has neither a durable artifact nor provider job ID");
    state = { ...state, status: "provider_completed" };
    await input.store.save(state);
  }

  if (state?.status === "submitting") {
    throw new ProviderSubmissionUncertainError();
  }

  const requestedSeconds = Math.round(input.scene.endSec - input.scene.startSec);
  let reservation: BudgetReservation;

  if (!state || state.status === "failed") {
    const attemptNumber = nextAttemptNumber(state);
    if (attemptNumber > MAX_PROVIDER_ATTEMPTS_PER_CALL) {
      throw new Error(`Video scene exceeded ${MAX_PROVIDER_ATTEMPTS_PER_CALL} provider attempts`);
    }
    const providerAttemptId = randomUUID();
    const reservationKey = `video-scene:${providerAttemptId}`;
    reservation = await input.budget.reserve(
      reservationKey,
      attemptNumber,
      providerCallBudget({ generatedVideoSeconds: requestedSeconds }),
    );
    try {
      await input.usage.begin({ attemptId: providerAttemptId, attemptNumber, requestedSeconds });
    } catch (error) {
      await input.budget.releaseBeforeStart(reservation);
      throw error;
    }
    state = {
      fingerprint: input.fingerprint,
      attemptNumber,
      providerAttemptId,
      reservationKey,
      requestedSeconds,
      status: "submitting",
    };
    try {
      await input.store.save(state);
    } catch (error) {
      const cleanup = await Promise.allSettled([
        input.usage.cancelBeforeStart({
          attemptId: providerAttemptId,
          error: errorMessage(error),
        }),
        input.budget.releaseBeforeStart(reservation),
      ]);
      const cleanupFailure = cleanup.find((result) => result.status === "rejected");
      if (cleanupFailure?.status === "rejected") throw cleanupFailure.reason;
      throw error;
    }

    await input.lease?.assertOwned();
    let providerJobId: string;
    try {
      providerJobId = await input.provider.submit(input.scene, input.model);
    } catch (error) {
      // A transport error does not prove rejection. Keep the `submitting`
      // marker, pending ledger row, and full reservation for reconciliation.
      throw new ProviderSubmissionUncertainError();
    }

    state = { ...state, status: "submitted", providerJobId };
    // If this write fails, the provider may already be running. The preceding
    // `submitting` marker and retained reservation prevent an automatic retry.
    try {
      await input.store.save(state);
    } catch {
      throw new ProviderSubmissionUncertainError();
    }
  } else {
    reservation = await input.budget.reserve(
      state.reservationKey,
      state.attemptNumber,
      providerCallBudget({ generatedVideoSeconds: state.requestedSeconds }),
    );
  }

  if (!state.providerJobId) throw new ProviderSubmissionUncertainError();

  if (state.status === "submitted") {
    try {
      await input.lease?.assertOwned();
      await input.provider.waitForCompletion(state.providerJobId);
    } catch (error) {
      if (!(error instanceof ProviderJobFailedError)) throw error;
      const message = errorMessage(error);
      await input.usage.fail({ attemptId: state.providerAttemptId, error: message });
      await input.budget.finalize(reservation, {
        providerCalls: 1,
        generatedVideoSeconds: null,
      });
      state = { ...state, status: "failed", error: message };
      await input.store.save(state);
      throw error;
    }
    await input.usage.succeed({
      attemptId: state.providerAttemptId,
      generatedSeconds: state.requestedSeconds,
    });
    await input.budget.finalize(reservation, {
      providerCalls: 1,
      generatedVideoSeconds: state.requestedSeconds,
    });
    state = { ...state, status: "provider_completed" };
    await input.store.save(state);
  }

  const providerJobId = state.providerJobId;
  if (!providerJobId) throw new ProviderSubmissionUncertainError();
  await input.lease?.assertOwned();
  const localPath = await input.provider.materialize(providerJobId);
  const artifactKey = await input.store.persistCompleted(localPath, state);
  state = { ...state, status: "completed", artifactKey };
  await input.store.save(state);
  return localPath;
}
