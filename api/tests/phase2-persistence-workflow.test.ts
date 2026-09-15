import assert from "node:assert/strict";
import test from "node:test";
import sequelize from "../src/configs/db.config";
import Reels from "../src/models/reels.model";
import WorkflowArtifact from "../src/models/workflow-artifact.model";
import WorkflowStageAttempt from "../src/models/workflow-stage-attempt.model";
import {
  claimWorkflowStageAttempt,
  putWorkflowArtifact,
  seedSucceededWorkflowStages,
} from "../src/repositories/workflow-execution.repository";

const pipelineId = "22222222-2222-4222-8222-222222222222";
const userId = "user-1";
const fakeTransaction = { LOCK: { UPDATE: "UPDATE" } };

test("distinct execution keys serialize their first claim on the reel row", async () => {
  const originals = {
    transaction: sequelize.transaction,
    reelFindOne: Reels.findOne,
    attemptFindOne: WorkflowStageAttempt.findOne,
    attemptFindOrCreate: WorkflowStageAttempt.findOrCreate,
  };
  type FakeTransaction = typeof fakeTransaction & { releaseParentLock?: () => void };
  let parentLocked = false;
  const parentWaiters: Array<() => void> = [];
  const events: string[] = [];
  const runningRows: Array<Record<string, any>> = [];

  const acquireParentLock = async (transaction: FakeTransaction) => {
    if (parentLocked) {
      await new Promise<void>((resolve) => parentWaiters.push(resolve));
    }
    parentLocked = true;
    transaction.releaseParentLock = () => {
      const next = parentWaiters.shift();
      if (next) next();
      else parentLocked = false;
    };
  };

  Object.assign(sequelize, {
    transaction: async (callback: (transaction: FakeTransaction) => unknown) => {
      const transaction: FakeTransaction = { LOCK: { UPDATE: "UPDATE" } };
      try {
        return await callback(transaction);
      } finally {
        transaction.releaseParentLock?.();
      }
    },
  });
  Object.assign(Reels, {
    findOne: async (options: { lock?: string; transaction?: FakeTransaction }) => {
      assert.ok(options.transaction, "claim must read the reel in its transaction");
      assert.equal(options.lock, options.transaction.LOCK.UPDATE, "claim must lock the stable reel row");
      await acquireParentLock(options.transaction);
      events.push("parent-locked");
      return { id: pipelineId, userId };
    },
  });
  Object.assign(WorkflowStageAttempt, {
    findOne: async ({ where }: { where: { status: string } }) => {
      if (where.status === "succeeded") return null;
      return runningRows.at(-1) ?? null;
    },
    findOrCreate: async ({ defaults }: { defaults: Record<string, any> }) => {
      // Yield while holding the parent lock. A competing claim can only inspect
      // stage rows after this transaction has inserted its running attempt.
      await new Promise<void>((resolve) => setImmediate(resolve));
      const checkpoint = { ...defaults };
      runningRows.push(checkpoint);
      events.push(`created:${defaults.executionKey}`);
      return [checkpoint, true];
    },
  });

  const claim = (executionKey: string, leaseOwner: string) => claimWorkflowStageAttempt({
    pipelineId,
    userId,
    workflowVersion: 1,
    stage: "video",
    executionKey,
    leaseOwner,
    leaseDurationMs: 30_000,
  });

  try {
    const [first, second] = await Promise.all([
      claim("job-a", "worker-a"),
      claim("job-b", "worker-b"),
    ]);
    assert.equal(first.disposition, "claimed");
    assert.equal(second.disposition, "in_progress");
    assert.equal(runningRows.length, 1);
    assert.deepEqual(events, ["parent-locked", "created:job-a", "parent-locked"]);
  } finally {
    Object.assign(sequelize, { transaction: originals.transaction });
    Object.assign(Reels, { findOne: originals.reelFindOne });
    Object.assign(WorkflowStageAttempt, {
      findOne: originals.attemptFindOne,
      findOrCreate: originals.attemptFindOrCreate,
    });
  }
});

test("a new job execution key reuses a succeeded provider stage", async () => {
  const originals = {
    transaction: sequelize.transaction,
    reelFindOne: Reels.findOne,
    attemptFindOne: WorkflowStageAttempt.findOne,
    attemptFindOrCreate: WorkflowStageAttempt.findOrCreate,
  };
  let findOrCreateCalls = 0;
  const succeeded = {
    id: "11111111-1111-4111-8111-111111111111",
    pipelineId,
    workflowVersion: 1,
    stage: "audio",
    executionKey: "old-job",
    status: "succeeded",
    output: { artifactKey: "audio/final" },
  };
  Object.assign(sequelize, { transaction: async (callback: (transaction: unknown) => unknown) => callback(fakeTransaction) });
  Object.assign(Reels, { findOne: async () => ({ id: pipelineId, userId }) });
  Object.assign(WorkflowStageAttempt, {
    findOne: async ({ where }: { where: { status: string } }) => where.status === "succeeded" ? succeeded : null,
    findOrCreate: async () => { findOrCreateCalls += 1; throw new Error("must not create"); },
  });
  try {
    const result = await claimWorkflowStageAttempt({
      pipelineId,
      userId,
      workflowVersion: 1,
      stage: "audio",
      executionKey: "retried-job",
      leaseOwner: "worker-2",
      leaseDurationMs: 30_000,
    });
    assert.equal(result.disposition, "reuse");
    assert.equal(result.checkpoint.executionKey, "old-job");
    assert.equal(findOrCreateCalls, 0);
  } finally {
    Object.assign(sequelize, { transaction: originals.transaction });
    Object.assign(Reels, { findOne: originals.reelFindOne });
    Object.assign(WorkflowStageAttempt, {
      findOne: originals.attemptFindOne,
      findOrCreate: originals.attemptFindOrCreate,
    });
  }
});

test("legacy succeeded stage seeding is idempotent", async () => {
  const originals = {
    transaction: sequelize.transaction,
    reelFindOne: Reels.findOne,
    attemptFindOrCreate: WorkflowStageAttempt.findOrCreate,
  };
  const rows = new Map<string, Record<string, unknown>>();
  Object.assign(sequelize, { transaction: async (callback: (transaction: unknown) => unknown) => callback(fakeTransaction) });
  Object.assign(Reels, { findOne: async () => ({ id: pipelineId, userId }) });
  Object.assign(WorkflowStageAttempt, {
    findOrCreate: async ({ where, defaults }: { where: { stage: string }; defaults: Record<string, unknown> }) => {
      const existing = rows.get(where.stage);
      if (existing) return [existing, false];
      rows.set(where.stage, defaults);
      return [defaults, true];
    },
  });
  try {
    const input = {
      pipelineId,
      userId,
      workflowVersion: 1,
      stages: [{ stage: "script", executionKey: "legacy-v1", output: { source: "finalScript" } }],
    };
    await seedSucceededWorkflowStages(input);
    await seedSucceededWorkflowStages(input);
    assert.equal(rows.size, 1);
    assert.deepEqual(rows.get("script")?.output, { source: "finalScript" });
    assert.equal(rows.get("script")?.status, "succeeded");
  } finally {
    Object.assign(sequelize, { transaction: originals.transaction });
    Object.assign(Reels, { findOne: originals.reelFindOne });
    Object.assign(WorkflowStageAttempt, { findOrCreate: originals.attemptFindOrCreate });
  }
});

test("artifact writes supersede a deterministic key and retain its fingerprint", async () => {
  const originals = {
    transaction: sequelize.transaction,
    reelFindOne: Reels.findOne,
    artifactFindOne: WorkflowArtifact.findOne,
    artifactCreate: WorkflowArtifact.create,
  };
  let stored: Record<string, unknown> | null = null;
  Object.assign(sequelize, { transaction: async (callback: (transaction: unknown) => unknown) => callback(fakeTransaction) });
  Object.assign(Reels, { findOne: async () => ({ id: pipelineId, userId }) });
  Object.assign(WorkflowArtifact, {
    findOne: async () => stored,
    create: async (values: Record<string, unknown>) => {
      stored = {
        ...values,
        update: async (next: Record<string, unknown>) => { stored = { ...(stored ?? {}), ...next }; },
      };
      return stored;
    },
  });
  try {
    await putWorkflowArtifact({
      pipelineId,
      userId,
      artifactKey: "scene/0/video",
      kind: "scene-video",
      storageProvider: "s3",
      storageKey: "pipelines/p/scene-0-v1.mp4",
      fingerprint: "prompt-a",
    });
    await putWorkflowArtifact({
      pipelineId,
      userId,
      artifactKey: "scene/0/video",
      kind: "scene-video",
      storageProvider: "s3",
      storageKey: "pipelines/p/scene-0-v2.mp4",
      fingerprint: "prompt-b",
    });
    assert.equal(stored?.storageKey, "pipelines/p/scene-0-v2.mp4");
    assert.equal(stored?.fingerprint, "prompt-b");
  } finally {
    Object.assign(sequelize, { transaction: originals.transaction });
    Object.assign(Reels, { findOne: originals.reelFindOne });
    Object.assign(WorkflowArtifact, {
      findOne: originals.artifactFindOne,
      create: originals.artifactCreate,
    });
  }
});
