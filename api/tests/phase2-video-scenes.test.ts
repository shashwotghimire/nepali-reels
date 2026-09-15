import assert from "node:assert/strict";
import test from "node:test";
import type { Scene } from "../src/schema/video-spec.schema";
import type { BudgetAmounts } from "../src/helpers/phase2-budget.helper";
import type { ProviderBudgetContext } from "../src/services/pipeline/provider-budget.service";
import {
  generateVideoScene,
  ProviderJobFailedError,
  ProviderSubmissionUncertainError,
  type VideoSceneJobState,
  type VideoSceneProvider,
  type VideoSceneStateStore,
  type VideoSceneUsageLedger,
} from "../src/services/pipeline/video-scene-generation.service";

const scene: Scene = {
  startSec: 0,
  endSec: 6,
  bgPrompt: "Himalayan sunrise",
  captionText: "Morning",
};

function harness(options: {
  initialState?: VideoSceneJobState;
  rejectBudget?: boolean;
  submit?: () => Promise<string>;
  wait?: (jobId: string) => Promise<void>;
  failSubmittingSave?: boolean;
  failSubmittedSave?: boolean;
} = {}) {
  let state = options.initialState ?? null;
  let saveCount = 0;
  let submitCount = 0;
  let materializeCount = 0;
  let restoreCount = 0;
  const reservations: BudgetAmounts[] = [];
  const finalized: Array<Record<string, number | null>> = [];
  const begun: string[] = [];
  const succeeded: string[] = [];
  const failed: string[] = [];
  const cancelled: string[] = [];
  let released = 0;

  const store: VideoSceneStateStore = {
    load: async () => state,
    save: async (next) => {
      saveCount += 1;
      if (options.failSubmittingSave && next.status === "submitting") {
        throw new Error("database unavailable before provider submission");
      }
      if (options.failSubmittedSave && next.status === "submitted") {
        throw new Error("database unavailable after provider accepted job");
      }
      state = next;
    },
    restoreCompleted: async () => {
      restoreCount += 1;
      return state?.status === "completed" ? "/durable/clip.mp4" : null;
    },
    persistCompleted: async () => "v1/video-scene/0",
  };
  const budget: ProviderBudgetContext = {
    reserve: async (_key, _attempt, requested) => {
      if (options.rejectBudget) throw new Error("budget rejected");
      reservations.push(requested);
      return {
        pipelineId: "pipeline-1",
        userId: "user-1",
        reservationKey: _key,
        reserved: requested,
      };
    },
    finalize: async (_reservation, actual) => {
      finalized.push(actual as Record<string, number | null>);
    },
    releaseBeforeStart: async () => { released += 1; },
  };
  const provider: VideoSceneProvider = {
    submit: async () => {
      submitCount += 1;
      return options.submit ? options.submit() : `job-${submitCount}`;
    },
    waitForCompletion: options.wait ?? (async () => undefined),
    materialize: async () => {
      materializeCount += 1;
      return "/local/clip.mp4";
    },
  };
  const usage: VideoSceneUsageLedger = {
    begin: async ({ attemptId }) => { begun.push(attemptId); },
    cancelBeforeStart: async ({ attemptId }) => { cancelled.push(attemptId); },
    succeed: async ({ attemptId }) => { succeeded.push(attemptId); },
    fail: async ({ attemptId }) => { failed.push(attemptId); },
  };

  return {
    input: { scene, model: "model", fingerprint: "fingerprint", budget, store, provider, usage },
    inspect: () => ({
      state, saveCount, submitCount, materializeCount, restoreCount,
      reservations, finalized, begun, succeeded, failed, cancelled, released,
    }),
  };
}

test("a rejected scene reservation makes zero provider calls", async () => {
  const testRun = harness({ rejectBudget: true });
  await assert.rejects(generateVideoScene(testRun.input), /budget rejected/);
  const result = testRun.inspect();
  assert.equal(result.submitCount, 0);
  assert.equal(result.begun.length, 0);
  assert.equal(result.saveCount, 0);
  assert.equal(result.state, null);
});

test("a state-write failure before submission closes the ledger and releases capacity", async () => {
  const testRun = harness({ failSubmittingSave: true });
  await assert.rejects(generateVideoScene(testRun.input), /before provider submission/);
  const result = testRun.inspect();
  assert.equal(result.submitCount, 0);
  assert.equal(result.begun.length, 1);
  assert.equal(result.cancelled.length, 1);
  assert.equal(result.released, 1);
});

test("an interrupted submitted job is reconciled without resubmission", async () => {
  let waits = 0;
  const testRun = harness({
    wait: async () => {
      waits += 1;
      if (waits === 1) throw new Error("worker interrupted while polling");
    },
  });

  await assert.rejects(generateVideoScene(testRun.input), /interrupted/);
  assert.equal(testRun.inspect().state?.status, "submitted");
  assert.equal(testRun.inspect().submitCount, 1);
  assert.equal(testRun.inspect().finalized.length, 0);
  assert.equal(testRun.inspect().reservations[0]?.providerCalls, 1);
  assert.equal(testRun.inspect().reservations[0]?.generatedVideoSeconds, 6);
  assert.equal(testRun.inspect().released, 0);

  assert.equal(await generateVideoScene(testRun.input), "/local/clip.mp4");
  const result = testRun.inspect();
  assert.equal(result.submitCount, 1);
  assert.equal(result.state?.status, "completed");
  assert.equal(result.finalized.length, 1);
  assert.equal(result.finalized[0]?.generatedVideoSeconds, 6);
});

test("partial failure keeps a completed scene and retries only the failed scene", async () => {
  const first = harness();
  let secondWaits = 0;
  const second = harness({
    wait: async () => {
      secondWaits += 1;
      if (secondWaits === 1) throw new ProviderJobFailedError("provider reported failure");
    },
  });

  const initial = await Promise.allSettled([
    generateVideoScene(first.input),
    generateVideoScene(second.input),
  ]);
  assert.equal(initial[0]?.status, "fulfilled");
  assert.equal(initial[1]?.status, "rejected");
  assert.equal(first.inspect().state?.status, "completed");
  assert.equal(second.inspect().state?.status, "failed");

  assert.equal(await generateVideoScene(first.input), "/durable/clip.mp4");
  assert.equal(await generateVideoScene(second.input), "/local/clip.mp4");
  assert.equal(first.inspect().submitCount, 1);
  assert.equal(second.inspect().submitCount, 2);
  assert.equal(first.inspect().restoreCount, 1);
  assert.equal(second.inspect().state?.attemptNumber, 2);
});

test("the provider-acceptance persistence window blocks automatic resubmission", async () => {
  const testRun = harness({ failSubmittedSave: true });
  await assert.rejects(generateVideoScene(testRun.input), ProviderSubmissionUncertainError);
  assert.equal(testRun.inspect().state?.status, "submitting");
  assert.equal(testRun.inspect().submitCount, 1);
  assert.equal(testRun.inspect().finalized.length, 0);

  await assert.rejects(
    generateVideoScene(testRun.input),
    ProviderSubmissionUncertainError,
  );
  assert.equal(testRun.inspect().submitCount, 1);
});

test("scene retries stop after three provider-reported failures", async () => {
  const testRun = harness({
    wait: async () => { throw new ProviderJobFailedError("failed"); },
  });
  for (let attempt = 1; attempt <= 3; attempt += 1) {
    await assert.rejects(generateVideoScene(testRun.input), ProviderJobFailedError);
  }
  await assert.rejects(generateVideoScene(testRun.input), /exceeded 3 provider attempts/);
  assert.equal(testRun.inspect().submitCount, 3);
});
