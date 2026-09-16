import assert from "node:assert/strict";
import test from "node:test";
import sequelize from "../src/configs/db.config";
import Reels from "../src/models/reels.model";
import WorkflowStageAttempt from "../src/models/workflow-stage-attempt.model";
import { saveDraftScript } from "../src/repositories/reels.repository";
import type { ScriptOutput } from "../src/schema/script-writer.schema";
import { runWithActiveStageLease } from "../src/services/pipeline/workflow-lease.service";
import { WorkflowLeaseLostError } from "../src/types/workflow-lease.types";

const pipelineId = "22222222-2222-4222-8222-222222222222";
const userId = "user-1";
const transaction = { LOCK: { UPDATE: "UPDATE" } };

test("a stale script stage cannot overwrite successor reel data or status", async () => {
  const originals = {
    transaction: sequelize.transaction,
    reelFindOne: Reels.findOne,
    attemptFindByPk: WorkflowStageAttempt.findByPk,
  };
  let saves = 0;
  const successorScript = { titleOptions: ["successor"] };
  const reel = {
    id: pipelineId,
    userId,
    draftScript: successorScript,
    pipelineStatus: "script_generated",
    save: async () => { saves += 1; },
  };
  Object.assign(sequelize, {
    transaction: async (callback: (tx: unknown) => unknown) => callback(transaction),
  });
  Object.assign(Reels, { findOne: async () => reel });
  Object.assign(WorkflowStageAttempt, {
    findByPk: async () => ({
      id: "stage-1",
      pipelineId,
      status: "running",
      leaseOwner: "same-job:new-worker",
      leaseExpiresAt: new Date(Date.now() + 60_000),
    }),
  });
  try {
    await assert.rejects(
      saveDraftScript(
        pipelineId,
        userId,
        { titleOptions: ["stale"] } as ScriptOutput,
        { stageAttemptId: "stage-1", leaseOwner: "same-job:old-worker" },
      ),
      WorkflowLeaseLostError,
    );
    assert.equal(reel.draftScript, successorScript);
    assert.equal(reel.pipelineStatus, "script_generated");
    assert.equal(saves, 0);
  } finally {
    Object.assign(sequelize, { transaction: originals.transaction });
    Object.assign(Reels, { findOne: originals.reelFindOne });
    Object.assign(WorkflowStageAttempt, { findByPk: originals.attemptFindByPk });
  }
});

test("upload, notification, and publishing side effects do not start after lease loss", async () => {
  let sideEffects = 0;
  const lease = {
    stageAttemptId: "stage-1",
    leaseOwner: "old-worker",
    assertOwned: async () => { throw new WorkflowLeaseLostError(); },
  };

  for (const name of ["upload", "notification", "publish"]) {
    await assert.rejects(runWithActiveStageLease(lease, async () => {
      sideEffects += 1;
      return name;
    }), WorkflowLeaseLostError);
  }
  assert.equal(sideEffects, 0);
});
