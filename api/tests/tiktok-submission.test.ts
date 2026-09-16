import assert from "node:assert/strict";
import test from "node:test";
import sequelize from "../src/configs/db.config";
import Reels from "../src/models/reels.model";
import TiktokConnection from "../src/models/tiktok-connection.model";
import WorkflowStageAttempt from "../src/models/workflow-stage-attempt.model";
import redis from "../src/configs/redis.config";
import { tiktokQueue } from "../src/queue/tiktok.queue";
import { beginTiktokSubmission } from "../src/repositories/reels.repository";
import {
  TiktokSubmissionUncertainError,
  uploadToTiktokService,
} from "../src/services/tiktok.service";

const pipelineId = "22222222-2222-4222-8222-222222222222";
const userId = "user-1";
const transaction = { LOCK: { UPDATE: "UPDATE" } };

test("uncertain auto-publish blocks a following manual publish", async () => {
  const originals = {
    transaction: sequelize.transaction,
    reelFindOne: Reels.findOne,
    connectionFindOne: TiktokConnection.findOne,
    attemptFindByPk: WorkflowStageAttempt.findByPk,
    fetch: globalThis.fetch,
  };
  const reel = {
    id: pipelineId,
    userId,
    pipelineStatus: "video_generated",
    s3key: "reels/pipeline/final.mp4",
    videoDurationSec: 30,
    tiktokPublishId: null as string | null,
    tiktokSubmissionState: null as "submitting" | "submitted" | null,
    tiktokSubmissionAttemptId: null as string | null,
    save: async () => {},
  };
  const lease = {
    stageAttemptId: "auto-publish-stage",
    leaseOwner: "auto-worker",
  };
  Object.assign(sequelize, {
    transaction: async (callback: (tx: unknown) => unknown) => callback(transaction),
  });
  Object.assign(Reels, { findOne: async () => reel });
  Object.assign(TiktokConnection, {
    findOne: async () => ({
      tiktokAccessToken: "access-token",
      tiktokRefreshToken: "refresh-token",
      tiktokExpiresAt: Date.now() + 60 * 60 * 1_000,
      tiktokRefreshExpiresAt: Date.now() + 24 * 60 * 60 * 1_000,
    }),
  });
  Object.assign(WorkflowStageAttempt, {
    findByPk: async () => ({
      id: lease.stageAttemptId,
      pipelineId,
      status: "running",
      leaseOwner: lease.leaseOwner,
      leaseExpiresAt: new Date(Date.now() + 60_000),
    }),
  });
  const fetchedUrls: string[] = [];
  globalThis.fetch = (async (url: string | URL | Request) => {
    fetchedUrls.push(String(url));
    return {
      json: async () => ({
        error: { code: "ok" },
        data: {
          privacy_level_options: ["PUBLIC_TO_EVERYONE"],
          max_video_post_duration_sec: 60,
        },
      }),
    } as Response;
  }) as typeof fetch;
  try {
    const automatic = await beginTiktokSubmission(pipelineId, userId, lease);
    assert.equal(automatic.disposition, "started");
    if (automatic.disposition !== "started") throw new Error("automatic submission did not start");
    assert.equal(reel.tiktokSubmissionState, "submitting");

    // Simulate TikTok accepting the request while its response is lost: the
    // durable marker remains and the controller's lease-less call must stop.
    const manual = await beginTiktokSubmission(pipelineId, userId);
    assert.equal(manual.disposition, "uncertain");
    assert.equal(reel.tiktokSubmissionAttemptId, automatic.submissionAttemptId);

    await assert.rejects(
      uploadToTiktokService(
        userId,
        pipelineId,
        "Title #tag",
        "PUBLIC_TO_EVERYONE",
        false,
        false,
        false,
        false,
        false,
        true,
      ),
      TiktokSubmissionUncertainError,
    );
    assert.equal(
      fetchedUrls.filter((url) => url.includes("/publish/video/init/")).length,
      0,
      "manual publish must stop before a second TikTok submission",
    );
  } finally {
    Object.assign(sequelize, { transaction: originals.transaction });
    Object.assign(Reels, { findOne: originals.reelFindOne });
    Object.assign(TiktokConnection, { findOne: originals.connectionFindOne });
    Object.assign(WorkflowStageAttempt, { findByPk: originals.attemptFindByPk });
    globalThis.fetch = originals.fetch;
    await tiktokQueue.close();
    redis.disconnect();
  }
});
