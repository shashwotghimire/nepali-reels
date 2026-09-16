import { Op, type Transaction } from "sequelize";
import { randomUUID } from "node:crypto";
import sequelize from "../configs/db.config";
import Reels from "../models/reels.model";
import WorkflowStageAttempt from "../models/workflow-stage-attempt.model";
import WorkflowArtifact from "../models/workflow-artifact.model";
import ScriptRevisionRequest from "../models/script-revision-request.model";
import { createHash } from "node:crypto";
import { ScriptOutput } from "../schema/script-writer.schema";
import { VideoSpec } from "../schema/video-spec.schema";
import type { StoryScriptOutput, StoryVideoSpec } from "../schema/story.schema";
import type { ListScriptOutput, ListVideoSpec } from "../schema/list.schema";
import type { CaptionPreset, ChannelStyleSnapshot, PipelineContentInput, PipelineStatus, VideoType } from "../types/pipeline.types";
import {
  WorkflowLeaseLostError,
  type WorkflowLeaseWriteFence,
} from "../types/workflow-lease.types";

async function findOwnedPipelineForUpdate(
  pipelineId: string,
  userId: string,
  transaction: Transaction,
) {
  const pipeline = await Reels.findOne({
    where: { id: pipelineId, userId },
    transaction,
    lock: transaction.LOCK.UPDATE,
  });
  if (!pipeline) throw new Error("Reel not found");
  return pipeline;
}

async function mutatePipelineWithLease(
  pipelineId: string,
  userId: string,
  lease: WorkflowLeaseWriteFence | undefined,
  mutate: (pipeline: Reels, transaction?: Transaction) => Promise<void> | void,
) {
  if (!lease) {
    const pipeline = await Reels.findOne({ where: { id: pipelineId, userId } });
    if (!pipeline) throw new Error("Reel not found");
    await mutate(pipeline);
    await pipeline.save();
    return;
  }

  await sequelize.transaction(async (transaction) => {
    // Match claim/takeover lock ordering: the stable reel row is always locked
    // before its stage attempt. This keeps validation and mutation atomic.
    const pipeline = await findOwnedPipelineForUpdate(pipelineId, userId, transaction);
    await assertPipelineLease(pipelineId, lease, transaction);
    await mutate(pipeline, transaction);
    await pipeline.save({ transaction });
  });
}

async function assertPipelineLease(
  pipelineId: string,
  lease: WorkflowLeaseWriteFence | undefined,
  transaction: Transaction,
) {
  if (!lease) return;
  const attempt = await WorkflowStageAttempt.findByPk(lease.stageAttemptId, {
    transaction,
    lock: transaction.LOCK.UPDATE,
  });
  const now = Date.now();
  if (
    !attempt
    || attempt.pipelineId !== pipelineId
    || attempt.status !== "running"
    || attempt.leaseOwner !== lease.leaseOwner
    || !attempt.leaseExpiresAt
    || attempt.leaseExpiresAt.getTime() <= now
  ) throw new WorkflowLeaseLostError();
}

export const createPipeline = (
  userId: string,
  topic: string,
  claudeModel: string,
  videoModel: string,
  ttsVoice?: string,
  videoType: VideoType = "explainer",
  contentInput: PipelineContentInput = { videoType: "explainer" },
  captionPreset: CaptionPreset = "default",
  channelStyle: ChannelStyleSnapshot | null = null,
) => {
  return Reels.create({
    userId,
    topic,
    claudeModel,
    videoModel,
    ttsVoice: ttsVoice ?? "aoede",
    videoType,
    contentInput,
    workflowVersion: 1,
    pipelineStatus: "queued",
    captionPreset,
    channelStyle,
  });
};

export const saveDraftScript = async (
  pipelineId: string,
  userId: string,
  draftScript: ScriptOutput | StoryScriptOutput | ListScriptOutput,
  lease?: WorkflowLeaseWriteFence,
) => {
  await mutatePipelineWithLease(pipelineId, userId, lease, (pipeline) => {
    pipeline.draftScript = draftScript;
    pipeline.pipelineStatus = "script_generated";
  });
};

export const saveFinalScript = async (
  pipelineId: string,
  userId: string,
  finalScript: ScriptOutput | StoryScriptOutput | ListScriptOutput,
  lease?: WorkflowLeaseWriteFence,
) => {
  await mutatePipelineWithLease(pipelineId, userId, lease, (pipeline) => {
    pipeline.finalScript = finalScript;
    pipeline.pipelineStatus = "awaiting_script_approval";
  });
};

export const saveLinguisticReview = async (
  pipelineId: string,
  userId: string,
  finalScript: ScriptOutput | StoryScriptOutput | ListScriptOutput,
  lease?: WorkflowLeaseWriteFence,
) => {
  await mutatePipelineWithLease(pipelineId, userId, lease, (pipeline) => {
    pipeline.finalScript = finalScript;
    pipeline.pipelineStatus = "awaiting_script_approval";
  });
};

const productionStages = [
  "video_spec", "story_video_spec", "list_video_spec", "audio", "alignment",
  "video", "thumbnail", "render", "upload", "notify", "publish",
];

function fingerprintScript(script: object) {
  return createHash("sha256").update(JSON.stringify(script)).digest("hex");
}

/** Replaces the reviewable script and atomically prevents reuse of superseded production work. */
export async function replaceReviewableScript(input: {
  pipelineId: string;
  userId: string;
  expectedVersion: number;
  script: object;
  incrementAiRevision?: boolean;
}) {
  return sequelize.transaction(async (transaction) => {
    const pipeline = await findOwnedPipelineForUpdate(input.pipelineId, input.userId, transaction);
    if (pipeline.s3key || ["video_generated", "publish_pending", "published"].includes(pipeline.pipelineStatus)) {
      throw new Error("Completed reels cannot be edited");
    }
    if (pipeline.scriptVersion !== input.expectedVersion) throw new Error("Script version conflict");
    pipeline.finalScript = input.script;
    pipeline.scriptVersion += 1;
    if (input.incrementAiRevision) pipeline.scriptRevisionCount += 1;
    pipeline.scriptApprovedAt = null;
    pipeline.approvedScriptFingerprint = null;
    pipeline.videoSpec = null;
    pipeline.soundSpec = null;
    pipeline.thumbnailUrl = null;
    pipeline.thumbnailVersions = null;
    pipeline.selectedThumbnailVersion = null;
    pipeline.pipelineStatus = "awaiting_script_approval";
    await pipeline.save({ transaction });
    await WorkflowStageAttempt.destroy({
      where: { pipelineId: input.pipelineId, stage: { [Op.in]: productionStages } }, transaction,
    });
    await WorkflowArtifact.destroy({ where: { pipelineId: input.pipelineId }, transaction });
    return pipeline;
  });
}

/** Approval is a compare-and-set on the current script version and contents. */
export async function approveCurrentScript(
  pipelineId: string, userId: string, expectedVersion: number,
) {
  return sequelize.transaction(async (transaction) => {
    const pipeline = await findOwnedPipelineForUpdate(pipelineId, userId, transaction);
    if (!pipeline.finalScript) throw new Error("No reviewed script is available");
    if (pipeline.scriptVersion !== expectedVersion) throw new Error("Script version conflict");
    const fingerprint = fingerprintScript(pipeline.finalScript);
    if (!pipeline.scriptApprovedAt) {
      pipeline.scriptApprovedAt = new Date();
      pipeline.approvedScriptFingerprint = fingerprint;
      pipeline.pipelineStatus = "script_finalised";
      await pipeline.save({ transaction });
    } else if (pipeline.approvedScriptFingerprint !== fingerprint) {
      throw new Error("Approved script fingerprint mismatch");
    }
    return pipeline;
  });
}

export type RevisionReservation =
  | { state: "reserved"; script: object; videoType: VideoType; model: string; scriptVersion: number }
  | { state: "completed"; result: object }
  | { state: "running" };

export async function reserveAiScriptRevision(input: { pipelineId: string; userId: string; idempotencyKey: string; expectedVersion: number; limit: number }): Promise<RevisionReservation> {
  return sequelize.transaction(async (transaction) => {
    const pipeline = await findOwnedPipelineForUpdate(input.pipelineId, input.userId, transaction);
    const existing = await ScriptRevisionRequest.findOne({ where: { pipelineId: input.pipelineId, idempotencyKey: input.idempotencyKey }, transaction, lock: transaction.LOCK.UPDATE });
    if (existing?.status === "succeeded" && existing.result) return { state: "completed", result: existing.result };
    if (existing?.status === "running") return { state: "running" };
    if (!pipeline.finalScript) throw new Error("Reviewable script not found");
    if (pipeline.scriptVersion !== input.expectedVersion) throw new Error("Script version conflict");
    if (pipeline.scriptRevisionCount >= input.limit) throw new Error("AI script revision limit reached");
    pipeline.scriptRevisionCount += 1;
    await pipeline.save({ transaction });
    if (existing) {
      existing.status = "running"; existing.scriptVersion = input.expectedVersion; existing.result = null;
      await existing.save({ transaction });
    } else {
      await ScriptRevisionRequest.create({ pipelineId: input.pipelineId, userId: input.userId, idempotencyKey: input.idempotencyKey, scriptVersion: input.expectedVersion, status: "running", result: null }, { transaction });
    }
    return { state: "reserved", script: pipeline.finalScript, videoType: pipeline.videoType, model: pipeline.claudeModel, scriptVersion: pipeline.scriptVersion };
  });
}

export async function completeAiScriptRevision(input: { pipelineId: string; userId: string; idempotencyKey: string; expectedVersion: number; script: object }) {
  return sequelize.transaction(async (transaction) => {
    const pipeline = await findOwnedPipelineForUpdate(input.pipelineId, input.userId, transaction);
    const request = await ScriptRevisionRequest.findOne({ where: { pipelineId: input.pipelineId, idempotencyKey: input.idempotencyKey, userId: input.userId }, transaction, lock: transaction.LOCK.UPDATE });
    if (!request || request.status !== "running" || pipeline.scriptVersion !== input.expectedVersion) throw new Error("Revision request is no longer current");
    pipeline.finalScript = input.script;
    pipeline.scriptVersion += 1;
    pipeline.scriptApprovedAt = null; pipeline.approvedScriptFingerprint = null;
    pipeline.videoSpec = null; pipeline.soundSpec = null; pipeline.thumbnailUrl = null;
    pipeline.thumbnailVersions = null; pipeline.selectedThumbnailVersion = null;
    pipeline.pipelineStatus = "awaiting_script_approval";
    request.status = "succeeded"; request.result = input.script;
    await pipeline.save({ transaction }); await request.save({ transaction });
    await WorkflowStageAttempt.destroy({ where: { pipelineId: input.pipelineId, stage: { [Op.in]: productionStages } }, transaction });
    await WorkflowArtifact.destroy({ where: { pipelineId: input.pipelineId }, transaction });
    return pipeline;
  });
}

export async function failAiScriptRevision(pipelineId: string, userId: string, idempotencyKey: string) {
  await sequelize.transaction(async (transaction) => {
    const pipeline = await findOwnedPipelineForUpdate(pipelineId, userId, transaction);
    const request = await ScriptRevisionRequest.findOne({ where: { pipelineId, userId, idempotencyKey }, transaction, lock: transaction.LOCK.UPDATE });
    if (request?.status === "running") { request.status = "failed"; pipeline.scriptRevisionCount = Math.max(0, pipeline.scriptRevisionCount - 1); await request.save({ transaction }); await pipeline.save({ transaction }); }
  });
}

export const saveVideoSpec = async (
  pipelineId: string,
  userId: string,
  videoSpec: VideoSpec | StoryVideoSpec | ListVideoSpec,
  lease?: WorkflowLeaseWriteFence,
) => {
  await mutatePipelineWithLease(pipelineId, userId, lease, (pipeline) => {
    pipeline.videoSpec = videoSpec;
    pipeline.pipelineStatus = "video_spec_generated";
  });
};

export const saveAudioSpec = async (
  pipelineId: string,
  userId: string,
  soundSpec: any,
  lease?: WorkflowLeaseWriteFence,
) => {
  await mutatePipelineWithLease(pipelineId, userId, lease, (pipeline) => {
    pipeline.soundSpec = soundSpec;
    pipeline.pipelineStatus = "sound_generated";
  });
};

export const saveVideoOutput = async (
  pipelineId: string,
  userId: string,
  s3key: string,
  videoDurationSec: number,
  lease?: WorkflowLeaseWriteFence,
) => {
  await mutatePipelineWithLease(pipelineId, userId, lease, (pipeline) => {
    pipeline.pipelineStatus = "video_generated";
    pipeline.s3key = s3key;
    pipeline.videoDurationSec = videoDurationSec;
  });
};

export const saveThumbnailUrl = async (
  pipelineId: string,
  userId: string,
  thumbnailUrl: string,
  lease?: WorkflowLeaseWriteFence,
) => {
  await mutatePipelineWithLease(pipelineId, userId, lease, (pipeline) => {
    pipeline.thumbnailUrl = thumbnailUrl;
    pipeline.thumbnailVersions = [{ version: 1, url: thumbnailUrl, artifactKey: `thumbnail:v1` }];
    pipeline.selectedThumbnailVersion = 1;
  });
};

export async function appendThumbnailVersion(pipelineId: string, userId: string, url: string, artifactKey: string) {
  return sequelize.transaction(async (transaction) => {
    const pipeline = await findOwnedPipelineForUpdate(pipelineId, userId, transaction);
    const versions = pipeline.thumbnailVersions ?? [];
    const version = versions.length + 1;
    pipeline.thumbnailVersions = [...versions, { version, url, artifactKey }];
    pipeline.thumbnailUrl = url;
    pipeline.selectedThumbnailVersion = version;
    await pipeline.save({ transaction });
    return pipeline;
  });
}

export async function reserveThumbnailRegeneration(input: { pipelineId: string; userId: string; idempotencyKey: string; limit: number }) {
  return sequelize.transaction(async (transaction) => {
    const pipeline = await findOwnedPipelineForUpdate(input.pipelineId, input.userId, transaction);
    const versions = pipeline.thumbnailVersions ?? [];
    const existing = versions.find((item) => item.artifactKey === `pending:${input.idempotencyKey}` || item.artifactKey === `thumbnail:${input.idempotencyKey}`);
    if (existing) return { state: existing.url ? "completed" as const : "running" as const, version: existing.version, pipeline };
    if (versions.length < 1 || versions.length - 1 >= input.limit) throw new Error("Thumbnail regeneration limit reached");
    const version = versions.length + 1;
    pipeline.thumbnailVersions = [...versions, { version, url: "", artifactKey: `pending:${input.idempotencyKey}` }];
    await pipeline.save({ transaction });
    return { state: "reserved" as const, version, pipeline };
  });
}

export async function completeThumbnailRegeneration(input: { pipelineId: string; userId: string; idempotencyKey: string; url: string }) {
  return sequelize.transaction(async (transaction) => {
    const pipeline = await findOwnedPipelineForUpdate(input.pipelineId, input.userId, transaction);
    const versions = pipeline.thumbnailVersions ?? [];
    const index = versions.findIndex((item) => item.artifactKey === `pending:${input.idempotencyKey}`);
    if (index < 0) throw new Error("Thumbnail regeneration reservation is missing");
    const version = versions[index]!.version;
    pipeline.thumbnailVersions = versions.map((item, current) => current === index ? { version, url: input.url, artifactKey: `thumbnail:${input.idempotencyKey}` } : item);
    pipeline.thumbnailUrl = input.url; pipeline.selectedThumbnailVersion = version;
    await pipeline.save({ transaction }); return pipeline;
  });
}

export async function releaseThumbnailRegeneration(pipelineId: string, userId: string, idempotencyKey: string) {
  return sequelize.transaction(async (transaction) => {
    const pipeline = await findOwnedPipelineForUpdate(pipelineId, userId, transaction);
    pipeline.thumbnailVersions = (pipeline.thumbnailVersions ?? []).filter((item) => item.artifactKey !== `pending:${idempotencyKey}`);
    await pipeline.save({ transaction });
  });
}

export async function selectThumbnailVersion(pipelineId: string, userId: string, version: number) {
  return sequelize.transaction(async (transaction) => {
    const pipeline = await findOwnedPipelineForUpdate(pipelineId, userId, transaction);
    const selected = pipeline.thumbnailVersions?.find((item) => item.version === version);
    if (!selected) throw new Error("Thumbnail version not found");
    pipeline.selectedThumbnailVersion = version;
    pipeline.thumbnailUrl = selected.url;
    await pipeline.save({ transaction });
    return pipeline;
  });
}

export const publishToTiktok = async (
  pipelineId: string,
  userId: string,
  tiktokPublishId: string,
  submissionAttemptId: string,
  lease?: WorkflowLeaseWriteFence,
) => {
  await sequelize.transaction(async (transaction) => {
    const pipeline = await findOwnedPipelineForUpdate(pipelineId, userId, transaction);
    await assertPipelineLease(pipelineId, lease, transaction);
    if (
      pipeline.tiktokSubmissionState !== "submitting"
      || pipeline.tiktokSubmissionAttemptId !== submissionAttemptId
    ) throw new Error("TikTok submission attempt is no longer active");
    pipeline.tiktokPublishId = tiktokPublishId;
    pipeline.tiktokSubmissionState = "submitted";
    pipeline.pipelineStatus = "publish_pending";
    await pipeline.save({ transaction });
  });
};

export type BeginTiktokSubmissionResult =
  | { disposition: "started"; submissionAttemptId: string }
  | { disposition: "existing"; publishId: string }
  | { disposition: "uncertain" }
  | { disposition: "not_ready" };

/** Atomically guards both workflow and manual TikTok submissions. */
export async function beginTiktokSubmission(
  pipelineId: string,
  userId: string,
  lease?: WorkflowLeaseWriteFence,
): Promise<BeginTiktokSubmissionResult> {
  return sequelize.transaction(async (transaction) => {
    const pipeline = await findOwnedPipelineForUpdate(pipelineId, userId, transaction);
    await assertPipelineLease(pipelineId, lease, transaction);
    if (pipeline.tiktokPublishId) {
      return { disposition: "existing", publishId: pipeline.tiktokPublishId };
    }
    if (pipeline.tiktokSubmissionState) return { disposition: "uncertain" };
    if (pipeline.pipelineStatus !== "video_generated") return { disposition: "not_ready" };

    const submissionAttemptId = randomUUID();
    pipeline.tiktokSubmissionState = "submitting";
    pipeline.tiktokSubmissionAttemptId = submissionAttemptId;
    await pipeline.save({ transaction });
    return { disposition: "started", submissionAttemptId };
  });
}

/** Clear only when TikTok explicitly rejected the matching request. */
export async function clearTiktokSubmission(
  pipelineId: string,
  userId: string,
  submissionAttemptId: string,
  lease?: WorkflowLeaseWriteFence,
): Promise<void> {
  await sequelize.transaction(async (transaction) => {
    const pipeline = await findOwnedPipelineForUpdate(pipelineId, userId, transaction);
    await assertPipelineLease(pipelineId, lease, transaction);
    if (
      pipeline.tiktokSubmissionState !== "submitting"
      || pipeline.tiktokSubmissionAttemptId !== submissionAttemptId
    ) throw new Error("TikTok submission attempt is no longer active");
    pipeline.tiktokSubmissionState = null;
    pipeline.tiktokSubmissionAttemptId = null;
    await pipeline.save({ transaction });
  });
}

export const savePipelineCost = async (
  pipelineId: string,
  userId: string,
  costUsd: number,
  costEstimateIncomplete = true,
  lease?: WorkflowLeaseWriteFence,
) => {
  await mutatePipelineWithLease(pipelineId, userId, lease, (pipeline) => {
    pipeline.costUsd = (pipeline.legacyCostUsd ?? 0) + costUsd;
    pipeline.costEstimateIncomplete = costEstimateIncomplete || pipeline.legacyCostUsd != null;
  });
};

export const resetPipelineForRetry = async (
  pipelineId: string,
  userId: string,
  resumeFromStatus: PipelineStatus,
) => {
  const pipeline = await Reels.findOne({ where: { id: pipelineId, userId } });
  if (!pipeline) throw new Error("Reel not found");
  pipeline.pipelineStatus = resumeFromStatus;
  pipeline.failureReason = null;
  await pipeline.save();
  return pipeline;
};

export const findPipelineById = (pipelineId: string, userId: string) => {
  return Reels.findOne({
    where: {
      id: pipelineId,
      userId,
    },
  });
};

export const findPipelineByPublishId = (tiktokPublishId: string) => {
  return Reels.findOne({ where: { tiktokPublishId } });
};

export const deletePipelineById = async (pipelineId: string, userId: string) => {
  const pipeline = await Reels.findOne({ where: { id: pipelineId, userId } });
  if (!pipeline) throw new Error("Reel not found");
  await pipeline.destroy();
};

export const findAllReelsOfUser = (
  userId: string,
  limit: number,
  offset: number,
  search?: string,
) => {
  const sanitized = search?.replace(/'/g, "''");
  const where = search
    ? {
        userId,
        [Op.or]: [
          { topic: { [Op.iLike]: `%${search}%` } },
          Reels.sequelize!.literal(
            `EXISTS (SELECT 1 FROM jsonb_array_elements_text("finalScript"->'hashtags') AS h WHERE h ILIKE '%${sanitized}%')`,
          ),
        ],
      }
    : { userId };
  return Reels.findAndCountAll({
    where,
    order: [["createdAt", "DESC"]],
    limit,
    offset,
  });
};
