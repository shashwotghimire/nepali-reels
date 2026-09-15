import assert from "node:assert/strict";
import test from "node:test";
import { Op } from "sequelize";
import sequelize from "../src/configs/db.config";
import Reels from "../src/models/reels.model";
import WorkflowArtifact from "../src/models/workflow-artifact.model";
import WorkflowStageAttempt from "../src/models/workflow-stage-attempt.model";
import {
  claimWorkflowStageAttempt,
  completeWorkflowStageAttempt,
  ensureStageProviderAttemptId,
  putWorkflowArtifact,
} from "../src/repositories/workflow-execution.repository";
import { createWorkflowLeaseOwner } from "../src/services/pipeline/workflow-checkpoint.service";
import {
  dispatchExplainerWorkflow,
  isWorkflowContentionError,
  shouldMarkPipelineFailed,
  WorkflowAlreadyRunningError,
} from "../src/services/pipeline/workflow-dispatcher.service";

const pipelineId = "22222222-2222-4222-8222-222222222222";
const userId = "user-1";
const transaction = { LOCK: { UPDATE: "UPDATE" } };

test("a replay of the same queue job receives a distinct fencing owner", () => {
  const first = createWorkflowLeaseOwner("job-7");
  const replay = createWorkflowLeaseOwner("job-7");
  assert.notEqual(first, replay);
  assert.match(first, /^job-7:/);
  assert.match(replay, /^job-7:/);
});

test("same-execution takeover replaces the expired lease owner", async () => {
  const originals = {
    transaction: sequelize.transaction,
    reelFindOne: Reels.findOne,
    attemptFindOne: WorkflowStageAttempt.findOne,
    attemptFindOrCreate: WorkflowStageAttempt.findOrCreate,
  };
  const expired = {
    id: "11111111-1111-4111-8111-111111111111",
    pipelineId,
    workflowVersion: 1,
    stage: "video",
    executionKey: "job-7",
    status: "running",
    leaseOwner: "job-7:old-worker",
    leaseExpiresAt: new Date(Date.now() - 1_000),
    reload: async () => {},
    save: async () => {},
  };
  Object.assign(sequelize, { transaction: async (callback: (tx: unknown) => unknown) => callback(transaction) });
  Object.assign(Reels, { findOne: async () => ({ id: pipelineId, userId }) });
  Object.assign(WorkflowStageAttempt, {
    findOne: async ({ where }: { where: { status: string } }) => where.status === "running" ? expired : null,
    findOrCreate: async () => [expired, false],
  });
  try {
    const result = await claimWorkflowStageAttempt({
      pipelineId, userId, workflowVersion: 1, stage: "video", executionKey: "job-7",
      leaseOwner: "job-7:new-worker", leaseDurationMs: 30_000,
    });
    assert.equal(result.disposition, "claimed");
    assert.equal(expired.leaseOwner, "job-7:new-worker");
    assert.ok(expired.leaseExpiresAt.getTime() > Date.now());
  } finally {
    Object.assign(sequelize, { transaction: originals.transaction });
    Object.assign(Reels, { findOne: originals.reelFindOne });
    Object.assign(WorkflowStageAttempt, {
      findOne: originals.attemptFindOne,
      findOrCreate: originals.attemptFindOrCreate,
    });
  }
});

test("completion requires the matching owner and an unexpired lease", async () => {
  const originalUpdate = WorkflowStageAttempt.update;
  let where: Record<string | symbol, unknown> | undefined;
  Object.assign(WorkflowStageAttempt, {
    update: async (_values: unknown, options: { where: Record<string | symbol, unknown> }) => {
      where = options.where;
      return [0];
    },
  });
  try {
    await assert.rejects(completeWorkflowStageAttempt({
      stageAttemptId: "attempt-1", leaseOwner: "old-worker",
    }), /not owned/);
    assert.equal(where?.leaseOwner, "old-worker");
    assert.ok(where?.leaseExpiresAt && (where.leaseExpiresAt as Record<symbol, Date>)[Op.gt] instanceof Date);
  } finally {
    Object.assign(WorkflowStageAttempt, { update: originalUpdate });
  }
});

test("expired workers cannot allocate provider identities or replace stage artifacts", async () => {
  const originals = {
    transaction: sequelize.transaction,
    reelFindOne: Reels.findOne,
    attemptFindByPk: WorkflowStageAttempt.findByPk,
    artifactFindOne: WorkflowArtifact.findOne,
  };
  const expiredAttempt = {
    id: "attempt-1", pipelineId, status: "running", leaseOwner: "old-worker",
    leaseExpiresAt: new Date(Date.now() - 1_000), providerAttemptId: null,
  };
  let artifactReads = 0;
  Object.assign(sequelize, { transaction: async (callback: (tx: unknown) => unknown) => callback(transaction) });
  Object.assign(Reels, { findOne: async () => ({ id: pipelineId, userId }) });
  Object.assign(WorkflowStageAttempt, { findByPk: async () => expiredAttempt });
  Object.assign(WorkflowArtifact, { findOne: async () => { artifactReads += 1; return null; } });
  try {
    await assert.rejects(ensureStageProviderAttemptId("attempt-1", "old-worker"), /not owned/);
    await assert.rejects(putWorkflowArtifact({
      pipelineId, userId, stageAttemptId: "attempt-1", leaseOwner: "old-worker",
      artifactKey: "video/final", kind: "video", storageProvider: "s3", storageKey: "key",
    }), /not owned/);
    assert.equal(artifactReads, 0);
  } finally {
    Object.assign(sequelize, { transaction: originals.transaction });
    Object.assign(Reels, { findOne: originals.reelFindOne });
    Object.assign(WorkflowStageAttempt, { findByPk: originals.attemptFindByPk });
    Object.assign(WorkflowArtifact, { findOne: originals.artifactFindOne });
  }
});

test("dispatcher renews a lease during long stage execution", async () => {
  let renewals = 0;
  await dispatchExplainerWorkflow({
    pipelineId, userId, executionKey: "job-long",
    checkpoints: {
      leaseRenewalIntervalMs: 2,
      claim: async () => ({ state: "claimed" }),
      renew: async () => { renewals += 1; },
      complete: async () => {},
      fail: async () => {},
    },
    executor: { execute: async () => new Promise((resolve) => setTimeout(resolve, 8)) },
  });
  assert.ok(renewals > 0);
});

test("active-work contention is distinguishable from execution failure", () => {
  const contention = new WorkflowAlreadyRunningError("script");
  assert.equal(isWorkflowContentionError(contention), true);
  assert.equal(shouldMarkPipelineFailed(contention), false);
  assert.equal(isWorkflowContentionError(new Error("provider failed")), false);
  assert.equal(shouldMarkPipelineFailed(new Error("provider failed")), true);
});
