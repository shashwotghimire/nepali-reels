import assert from "node:assert/strict";
import test from "node:test";
import sequelize from "../src/configs/db.config";
import Reels from "../src/models/reels.model";
import ProviderUsage from "../src/models/provider-usage.model";
import WorkflowStageAttempt from "../src/models/workflow-stage-attempt.model";
import { markPipelineFailedIfExecutionOwned } from "../src/repositories/workflow-execution.repository";
import { markPipelineAsFailedService } from "../src/services/pipeline/pipeline-failure.service";
import { shouldMarkPipelineFailed } from "../src/services/pipeline/workflow-dispatcher.service";
import { WorkflowLeaseLostError } from "../src/types/workflow-lease.types";

const pipelineId = "22222222-2222-4222-8222-222222222222";
const userId = "user-1";
const transaction = { LOCK: { UPDATE: "UPDATE" } };

test("an owned execution marks failure even when cost synchronization fails", async () => {
  const originals = {
    transaction: sequelize.transaction,
    reelFindOne: Reels.findOne,
    attemptFindOne: WorkflowStageAttempt.findOne,
    usageFindAll: ProviderUsage.findAll,
  };
  const originalError = console.error;
  const failures: string[] = [];
  let saves = 0;
  const reel = {
    pipelineStatus: "queued",
    failureReason: null as string | null,
    legacyCostUsd: null,
    costUsd: null as number | null,
    costEstimateIncomplete: false,
    save: async () => { saves += 1; },
  };
  Object.assign(sequelize, {
    transaction: async (callback: (tx: unknown) => unknown) => callback(transaction),
  });
  Object.assign(Reels, { findOne: async () => reel });
  Object.assign(WorkflowStageAttempt, {
    findOne: async () => ({ executionKey: "job-1", leaseOwner: "job-1:worker-1" }),
  });
  Object.assign(ProviderUsage, {
    findAll: async () => { throw new Error("ledger unavailable"); },
  });
  console.error = (...args: unknown[]) => { failures.push(args.map(String).join(" ")); };
  try {
    assert.equal(await markPipelineAsFailedService(
      pipelineId,
      "provider failed",
      userId,
      { executionKey: "job-1", leaseOwner: "job-1:worker-1" },
    ), true);
    assert.equal(reel.pipelineStatus, "failed");
    assert.equal(reel.failureReason, "provider failed");
    assert.equal(saves, 1);
    assert.match(failures[0] ?? "", /ledger unavailable/);
  } finally {
    Object.assign(sequelize, { transaction: originals.transaction });
    Object.assign(Reels, { findOne: originals.reelFindOne });
    Object.assign(WorkflowStageAttempt, { findOne: originals.attemptFindOne });
    Object.assign(ProviderUsage, { findAll: originals.usageFindAll });
    console.error = originalError;
  }
});

for (const successorStatus of ["running", "succeeded"] as const) {
  test(`an old worker cannot mark failed after its successor is ${successorStatus}`, async () => {
    const originals = {
      transaction: sequelize.transaction,
      reelFindOne: Reels.findOne,
      attemptFindOne: WorkflowStageAttempt.findOne,
    };
    let saves = 0;
    const reel = {
      pipelineStatus: successorStatus === "running" ? "sound_generated" : "video_generated",
      failureReason: null as string | null,
      save: async () => { saves += 1; },
    };
    Object.assign(sequelize, {
      transaction: async (callback: (tx: unknown) => unknown) => callback(transaction),
    });
    Object.assign(Reels, { findOne: async () => reel });
    Object.assign(WorkflowStageAttempt, {
      findOne: async () => ({
        executionKey: "same-job",
        leaseOwner: "same-job:new-worker",
        status: successorStatus,
      }),
    });
    try {
      const transitioned = await markPipelineFailedIfExecutionOwned({
        pipelineId,
        userId,
        workflowVersion: 1,
        executionKey: "same-job",
        leaseOwner: "same-job:old-worker",
        failureReason: "old worker resumed",
      });
      assert.equal(transitioned, false);
      assert.notEqual(reel.pipelineStatus, "failed");
      assert.equal(reel.failureReason, null);
      assert.equal(saves, 0);
    } finally {
      Object.assign(sequelize, { transaction: originals.transaction });
      Object.assign(Reels, { findOne: originals.reelFindOne });
      Object.assign(WorkflowStageAttempt, { findOne: originals.attemptFindOne });
    }
  });
}

test("lease loss is not classified as a pipeline failure", () => {
  assert.equal(shouldMarkPipelineFailed(new WorkflowLeaseLostError()), false);
  assert.equal(shouldMarkPipelineFailed(new Error("provider failed")), true);
});
