import assert from "node:assert/strict";
import test from "node:test";
import {
  findExceededBudgetMetric,
  resolveFinalBudgetAmounts,
  type BudgetAmounts,
} from "../src/helpers/phase2-budget.helper";
import {
  GenerationBudgetExceededError,
  finalizeProviderCallBudget,
  getGenerationBudgetLimits,
  providerCallBudget,
  reserveProviderCallBudget,
  type BudgetReservationRepository,
} from "../src/services/pipeline/budget-policy.service";
import {
  GenerationAccessUnavailableError,
  assertDeliveredDurationAllowed,
  resolveGenerationEntitlement,
  resolveLegacyCompatibilityAccess,
  type GenerationAccessRepository,
  type ResolvedGenerationEntitlement,
} from "../src/services/pipeline/entitlement-resolution.service";

const userId = "user-1";
const at = new Date("2026-09-15T00:00:00.000Z");

async function paidAccess(): Promise<ResolvedGenerationEntitlement> {
  return resolveGenerationEntitlement({
    findTrustedAccess: async () => ({
      kind: "subscription",
      grantId: "subscription-1",
      userId,
      status: "active",
      planId: "creator",
      periodEndsAt: new Date("2026-10-01T00:00:00.000Z"),
    }),
  }, userId, at);
}

test("access comes from a trusted server-side record and never assigns legacy users a trial", async () => {
  const unconfigured: GenerationAccessRepository = {
    findTrustedAccess: async () => null,
  };
  await assert.rejects(
    resolveGenerationEntitlement(unconfigured, userId, at),
    GenerationAccessUnavailableError,
  );

  const access = await paidAccess();
  assert.equal(access.entitlement.id, "creator");
  assert.equal(access.accessKind, "subscription");
  const legacy = resolveLegacyCompatibilityAccess(userId);
  assert.equal(legacy.accessKind, "legacy_compatibility");
  assert.equal(legacy.entitlement.id, "legacy_standard");
  assert.notEqual(legacy.entitlement.id, "trial");
});

test("verified trial and paid access use distinct trusted delivered-duration limits", async () => {
  const trial = await resolveGenerationEntitlement({
    findTrustedAccess: async () => ({
      kind: "verified_trial",
      grantId: "trial-1",
      userId,
      status: "active",
      identityVerified: true,
    }),
  }, userId, at);
  const paid = await paidAccess();

  assert.doesNotThrow(() => assertDeliveredDurationAllowed(trial, 30));
  assert.throws(() => assertDeliveredDurationAllowed(trial, 30.001), /30-second trial limit/);
  assert.doesNotThrow(() => assertDeliveredDurationAllowed(paid, 75));
  assert.throws(() => assertDeliveredDurationAllowed(paid, 75.001), /75-second creator limit/);
});

test("unknown actual metrics retain their reservation instead of becoming free usage", () => {
  const reserved = providerCallBudget({ inputTokens: 1_000, outputTokens: 500 });
  assert.deepEqual(
    resolveFinalBudgetAmounts(reserved, { inputTokens: 800, outputTokens: null }),
    providerCallBudget({ inputTokens: 800, outputTokens: 500 }),
  );
});

test("finalization sends conservative resource totals to persistence", async () => {
  let finalized: BudgetAmounts | undefined;
  const repository: BudgetReservationRepository = {
    reserve: async () => {
      throw new Error("not used");
    },
    finalize: async (input) => {
      finalized = input.finalized;
    },
    release: async () => undefined,
  };
  const reserved = providerCallBudget({ inputTokens: 1_000, outputTokens: 500 });
  await finalizeProviderCallBudget(repository, {
    pipelineId: "pipeline-1",
    userId,
    reservationKey: "attempt-1",
    reserved,
  }, { inputTokens: 800, outputTokens: null });

  assert.deepEqual(
    finalized,
    providerCallBudget({ inputTokens: 800, outputTokens: 500 }),
  );
});

test("repository boundary atomically rejects one of two concurrent reservations", async () => {
  const access = await paidAccess();
  let used = providerCallBudget({ providerCalls: 0, inputTokens: 59_000 });
  const reservations = new Map<string, BudgetAmounts>();

  const repository: BudgetReservationRepository = {
    reserve: async (input) => {
      // This synchronous section models the transaction/row lock required from
      // the persistence implementation; both callers observe committed totals.
      const exceeded = findExceededBudgetMetric(used, input.requested, input.limits);
      if (exceeded) {
        return {
          kind: "limit_exceeded",
          metric: exceeded,
          used: used[exceeded],
          requested: input.requested[exceeded],
          limit: input.limits[exceeded],
        };
      }
      used = Object.fromEntries(
        Object.keys(used).map((metric) => [
          metric,
          used[metric as keyof BudgetAmounts] + input.requested[metric as keyof BudgetAmounts],
        ]),
      ) as unknown as BudgetAmounts;
      reservations.set(input.reservationKey, input.requested);
      return {
        kind: "reserved",
        reservation: {
          pipelineId: input.pipelineId,
          userId: input.userId,
          reservationKey: input.reservationKey,
          reserved: input.requested,
        },
      };
    },
    finalize: async () => undefined,
    release: async () => undefined,
  };

  const outcomes = await Promise.allSettled([
    reserveProviderCallBudget(repository, access, {
      pipelineId: "pipeline-1",
      reservationKey: "attempt-1",
      attemptNumber: 1,
      requested: providerCallBudget({ inputTokens: 750 }),
    }),
    reserveProviderCallBudget(repository, access, {
      pipelineId: "pipeline-1",
      reservationKey: "attempt-2",
      attemptNumber: 1,
      requested: providerCallBudget({ inputTokens: 750 }),
    }),
  ]);

  assert.equal(outcomes.filter((result) => result.status === "fulfilled").length, 1);
  const rejected = outcomes.find((result) => result.status === "rejected");
  assert.ok(rejected?.status === "rejected");
  assert.ok(rejected.reason instanceof GenerationBudgetExceededError);
  assert.equal(reservations.size, 1);
});

test("aggregate limits cover calls, tokens, searches, seconds, revisions and retry attempts", async () => {
  const access = await paidAccess();
  assert.deepEqual(getGenerationBudgetLimits(access), {
    providerCalls: 90,
    inputTokens: 60_000,
    outputTokens: 20_000,
    searches: 45,
    generatedVideoSeconds: 90,
    aiRevisions: 2,
  });

  const repository: BudgetReservationRepository = {
    reserve: async (input) => ({
      kind: "reserved",
      reservation: {
        pipelineId: input.pipelineId,
        userId: input.userId,
        reservationKey: input.reservationKey,
        reserved: input.requested,
      },
    }),
    finalize: async () => undefined,
    release: async () => undefined,
  };
  await assert.rejects(
    reserveProviderCallBudget(repository, access, {
      pipelineId: "pipeline-1",
      reservationKey: "attempt-4",
      attemptNumber: 4,
      requested: providerCallBudget(),
    }),
    /between 1 and 3/,
  );

  const limits = getGenerationBudgetLimits(access);
  for (const metric of Object.keys(limits) as (keyof BudgetAmounts)[]) {
    const used = { ...limits, [metric]: limits[metric] };
    const requested = providerCallBudget({
      providerCalls: 0,
      [metric]: 1,
    });
    assert.equal(
      findExceededBudgetMetric(used, requested, limits),
      metric,
      `${metric} must be enforced as an aggregate ceiling`,
    );
  }
});
