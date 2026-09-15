import assert from "node:assert/strict";
import test from "node:test";
import ProviderUsage from "../src/models/provider-usage.model";
import {
  beginProviderAttempt,
  finishProviderAttempt,
  getPipelineCostSummary,
} from "../src/repositories/provider-usage.repository";

const base = {
  attemptId: "11111111-1111-4111-8111-111111111111",
  userId: "user-1",
  pipelineId: "22222222-2222-4222-8222-222222222222",
  operation: "generate-script",
  stage: "script",
  provider: "anthropic",
  model: "claude-test",
};

test("begin is idempotent and preserves a completed attempt", async () => {
  const rows = new Map<string, Record<string, unknown>>();
  const original = ProviderUsage.findOrCreate;
  Object.assign(ProviderUsage, {
    findOrCreate: async ({ where, defaults }: { where: { attemptId: string }; defaults: Record<string, unknown> }) => {
      let row = rows.get(where.attemptId);
      const created = !row;
      if (!row) {
        row = { ...defaults };
        rows.set(where.attemptId, row);
      }
      return [row, created];
    },
  });
  try {
    await beginProviderAttempt(base);
    rows.get(base.attemptId)!.status = "failed";
    await beginProviderAttempt(base);
    assert.equal(rows.size, 1);
    assert.equal(rows.get(base.attemptId)?.status, "failed");
    await assert.rejects(
      beginProviderAttempt({ ...base, provider: "different-provider" }),
      /already belongs to another call/,
    );
  } finally {
    Object.assign(ProviderUsage, { findOrCreate: original });
  }
});

test("finish sets a result without incrementing cost on replay", async () => {
  const row: Record<string, unknown> = { attemptId: base.attemptId };
  const original = ProviderUsage.update;
  Object.assign(ProviderUsage, {
    update: async (values: Record<string, unknown>, options: { where: { attemptId: string } }) => {
      if (options.where.attemptId !== base.attemptId) return [0];
      Object.assign(row, values);
      return [1];
    },
  });
  try {
    const result = {
      attemptId: base.attemptId,
      status: "failed" as const,
      usage: { inputTokens: 12, outputTokens: 3, cacheReadTokens: 0 },
      costUsd: "0.00123456",
      costProvenance: "estimated" as const,
      rateVersion: "2026-09-14",
      error: "provider timeout",
    };
    await finishProviderAttempt(result);
    await finishProviderAttempt(result);
    assert.equal(row.costUsd, "0.00123456");
    assert.equal(row.inputTokens, 12);
    assert.equal(row.status, "failed");
    assert.equal(row.errorMessage, "provider timeout");
    await assert.rejects(
      finishProviderAttempt({ ...result, costUsd: null }),
      /Known provider cost requires an amount/,
    );
    await assert.rejects(
      finishProviderAttempt({ ...result, rateVersion: null }),
      /requires a rate version/,
    );
    await assert.rejects(
      finishProviderAttempt({ ...result, attemptId: "33333333-3333-4333-8333-333333333333" }),
      /was not begun/,
    );
  } finally {
    Object.assign(ProviderUsage, { update: original });
  }
});

test("summary includes billed failures and flags unknown or pending attempts", async () => {
  const original = ProviderUsage.findAll;
  Object.assign(ProviderUsage, {
    findAll: async (options: { where: { pipelineId: string; userId: string } }) => {
      assert.deepEqual(options.where, { pipelineId: base.pipelineId, userId: base.userId });
      return [
        { status: "succeeded", costUsd: "0.20" },
        { status: "failed", costUsd: "0.10" },
        { status: "failed", costUsd: null },
        { status: "pending", costUsd: null },
      ];
    },
  });
  try {
    const summary = await getPipelineCostSummary(base.pipelineId, base.userId);
    assert.equal(summary.knownCostUsd, 0.3);
    assert.equal(summary.hasUnknownCost, true);
  } finally {
    Object.assign(ProviderUsage, { findAll: original });
  }
});
