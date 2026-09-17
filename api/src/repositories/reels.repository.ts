import { Op, type Transaction } from "sequelize";
import { randomUUID } from "node:crypto";
import sequelize from "../configs/db.config";
import Reels from "../models/reels.model";
import WorkflowStageAttempt from "../models/workflow-stage-attempt.model";
import WorkflowArtifact from "../models/workflow-artifact.model";
import ScriptRevisionRequest from "../models/script-revision-request.model";
import ThumbnailGenerationRequest from "../models/thumbnail-generation-request.model";
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
  autoPublishRequested = false,
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
    autoPublishRequested,
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
    pipeline.pipelineStatus = "script_finalised";
  });
};

export const saveLinguisticReview = async (
  pipelineId: string,
  userId: string,
  finalScript: ScriptOutput | StoryScriptOutput | ListScriptOutput,
  lease?: WorkflowLeaseWriteFence,
  expectedScriptVersion?: number,
) => {
  await mutatePipelineWithLease(pipelineId, userId, lease, (pipeline) => {
    if (expectedScriptVersion !== undefined && pipeline.scriptVersion !== expectedScriptVersion) {
      throw new Error("Script was superseded while review was running");
    }
    if (pipeline.scriptApprovedAt || !["script_generated", "script_finalised"].includes(pipeline.pipelineStatus)) {
      throw new Error("Script is no longer eligible for review completion");
    }
    pipeline.finalScript = finalScript;
    pipeline.pipelineStatus = "awaiting_script_approval";
  });
};

const productionStages = [
  "video_spec", "story_video_spec", "list_video_spec", "audio", "alignment",
  "video", "thumbnail", "render", "upload", "notify", "publish",
];

function assertReviewableLifecycle(pipeline: Reels) {
  if (pipeline.s3key || pipeline.pipelineStatus !== "awaiting_script_approval" || pipeline.scriptApprovedAt) {
    throw new Error("Script is not editable in its current lifecycle state");
  }
}

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
    assertReviewableLifecycle(pipeline);
    if (await ScriptRevisionRequest.count({ where: { pipelineId: input.pipelineId, status: { [Op.in]: ["reserved", "submitted", "provider_succeeded", "uncertain"] } }, transaction })) throw new Error("An AI revision is still active");
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
      assertReviewableLifecycle(pipeline);
      if (await ScriptRevisionRequest.count({ where: { pipelineId, status: { [Op.in]: ["reserved", "submitted", "provider_succeeded", "uncertain"] } }, transaction })) throw new Error("An AI revision is still active");
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
  | { state: "reserved"; script: object; videoType: VideoType; model: string; scriptVersion: number; leaseOwner: string }
  | { state: "provider_succeeded"; result: object; scriptVersion: number; leaseOwner: string }
  | { state: "completed"; result: object }
  | { state: "running" }
  | { state: "uncertain" }
  | { state: "consumed" };

export async function reserveAiScriptRevision(input: { pipelineId: string; userId: string; idempotencyKey: string; expectedVersion: number; limit: number }): Promise<RevisionReservation> {
  return sequelize.transaction(async (transaction) => {
    const pipeline = await findOwnedPipelineForUpdate(input.pipelineId, input.userId, transaction);
    const existing = await ScriptRevisionRequest.findOne({ where: { pipelineId: input.pipelineId, idempotencyKey: input.idempotencyKey }, transaction, lock: transaction.LOCK.UPDATE });
    if (existing?.status === "applied" && existing.result) return { state: "completed", result: existing.result };
    assertReviewableLifecycle(pipeline);
    if (existing?.status === "provider_succeeded" && existing.result) return { state: "provider_succeeded", result: existing.result, scriptVersion: existing.scriptVersion, leaseOwner: existing.leaseOwner };
    if (existing?.status === "submitted") { existing.status = "uncertain"; await existing.save({ transaction }); return { state: "uncertain" }; }
    if (existing?.status === "uncertain") return { state: "uncertain" };
    if (existing?.status === "abandoned") return { state: "consumed" };
    if (existing?.status === "reserved" && existing.leaseExpiresAt > new Date()) return { state: "running" };
    if (!pipeline.finalScript) throw new Error("Reviewable script not found");
    if (pipeline.scriptVersion !== input.expectedVersion) throw new Error("Script version conflict");
    const consumesNewSlot = !existing || existing.status === "failed";
    if (consumesNewSlot && pipeline.scriptRevisionCount >= input.limit) throw new Error("AI script revision limit reached");
    if (consumesNewSlot) pipeline.scriptRevisionCount += 1;
    await pipeline.save({ transaction });
    if (existing) {
      existing.status = "reserved"; existing.scriptVersion = input.expectedVersion; existing.result = null; existing.leaseOwner = randomUUID(); existing.leaseExpiresAt = new Date(Date.now() + 5 * 60_000); existing.error = null;
      await existing.save({ transaction });
    } else {
      await ScriptRevisionRequest.create({ pipelineId: input.pipelineId, userId: input.userId, idempotencyKey: input.idempotencyKey, scriptVersion: input.expectedVersion, status: "reserved", result: null, leaseOwner: randomUUID(), leaseExpiresAt: new Date(Date.now() + 5 * 60_000), error: null }, { transaction });
    }
    const request = existing ?? await ScriptRevisionRequest.findOne({ where: { pipelineId: input.pipelineId, idempotencyKey: input.idempotencyKey }, transaction });
    return { state: "reserved", script: pipeline.finalScript, videoType: pipeline.videoType, model: pipeline.claudeModel, scriptVersion: pipeline.scriptVersion, leaseOwner: request!.leaseOwner };
  });
}

export async function markAiRevisionSubmitted(pipelineId: string, userId: string, idempotencyKey: string, leaseOwner: string) {
  const [count] = await ScriptRevisionRequest.update({ status: "submitted" }, { where: { pipelineId, userId, idempotencyKey, leaseOwner, status: "reserved" } });
  if (count !== 1) throw new Error("Revision reservation ownership was lost");
}
export async function saveAiRevisionProviderResult(pipelineId: string, userId: string, idempotencyKey: string, leaseOwner: string, result: object) {
  const [count] = await ScriptRevisionRequest.update({ status: "provider_succeeded", result }, { where: { pipelineId, userId, idempotencyKey, leaseOwner, status: "submitted" } });
  if (count !== 1) throw new Error("Revision provider result ownership was lost");
}
export async function markAiRevisionUncertain(pipelineId: string, userId: string, idempotencyKey: string, leaseOwner: string, error: string) {
  await ScriptRevisionRequest.update({ status: "uncertain", error }, { where: { pipelineId, userId, idempotencyKey, leaseOwner, status: "submitted" } });
}
export async function rejectAiRevisionProviderResult(pipelineId: string, userId: string, idempotencyKey: string, leaseOwner: string, error: string) {
  await ScriptRevisionRequest.update({ status: "failed", error }, { where: { pipelineId, userId, idempotencyKey, leaseOwner, status: "submitted" } });
}

export async function completeAiScriptRevision(input: { pipelineId: string; userId: string; idempotencyKey: string; expectedVersion: number; script: object; leaseOwner: string }) {
  return sequelize.transaction(async (transaction) => {
    const pipeline = await findOwnedPipelineForUpdate(input.pipelineId, input.userId, transaction);
    const request = await ScriptRevisionRequest.findOne({ where: { pipelineId: input.pipelineId, idempotencyKey: input.idempotencyKey, userId: input.userId }, transaction, lock: transaction.LOCK.UPDATE });
    assertReviewableLifecycle(pipeline);
    if (!request || request.status !== "provider_succeeded" || request.leaseOwner !== input.leaseOwner || pipeline.scriptVersion !== input.expectedVersion) throw new Error("Revision request is no longer current");
    pipeline.finalScript = input.script;
    pipeline.scriptVersion += 1;
    pipeline.scriptApprovedAt = null; pipeline.approvedScriptFingerprint = null;
    pipeline.videoSpec = null; pipeline.soundSpec = null; pipeline.thumbnailUrl = null;
    pipeline.thumbnailVersions = null; pipeline.selectedThumbnailVersion = null;
    pipeline.pipelineStatus = "awaiting_script_approval";
    request.status = "applied"; request.result = input.script;
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
    if (request?.status === "reserved") { request.status = "failed"; pipeline.scriptRevisionCount = Math.max(0, pipeline.scriptRevisionCount - 1); await request.save({ transaction }); await pipeline.save({ transaction }); }
  });
}

export async function abandonUncertainScriptRevision(pipelineId: string, userId: string, idempotencyKey: string) {
  const [count] = await ScriptRevisionRequest.update({ status: "abandoned", error: "User acknowledged uncertain provider outcome; entitlement remains consumed" }, { where: { pipelineId, userId, idempotencyKey, status: { [Op.in]: ["submitted", "uncertain"] } } });
  if (count !== 1) throw new Error("Uncertain script revision was not found");
}

export async function abandonUncertainThumbnailRegeneration(pipelineId: string, userId: string, idempotencyKey: string) {
  const [count] = await ThumbnailGenerationRequest.update({ status: "abandoned", error: "User acknowledged uncertain provider outcome; entitlement remains consumed" }, { where: { pipelineId, userId, idempotencyKey, status: { [Op.in]: ["submitted", "uncertain"] } } });
  if (count !== 1) throw new Error("Uncertain thumbnail regeneration was not found");
}

export async function findPhase4OperationIssues(pipelineId: string, userId: string) {
  const [revisions, thumbnails] = await Promise.all([
    ScriptRevisionRequest.findAll({ where: { pipelineId, userId, [Op.or]: [{ status: "uncertain" }, { status: "submitted", leaseExpiresAt: { [Op.lt]: new Date() } }] }, attributes: ["idempotencyKey", "status", "error", "updatedAt"] }),
    ThumbnailGenerationRequest.findAll({ where: { pipelineId, userId, [Op.or]: [{ status: "uncertain" }, { status: "submitted", leaseExpiresAt: { [Op.lt]: new Date() } }] }, attributes: ["idempotencyKey", "status", "error", "version", "updatedAt"] }),
  ]);
  return [
    ...revisions.map((request) => ({ kind: "script_revision" as const, ...request.toJSON() })),
    ...thumbnails.map((request) => ({ kind: "thumbnail_regeneration" as const, ...request.toJSON() })),
  ];
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

type ThumbnailReservation =
  | { state: "completed"; version: number; pipeline: Reels }
  | { state: "uncertain"; version: number; pipeline: Reels }
  | { state: "running"; version: number; pipeline: Reels }
  | { state: "consumed"; version: number; pipeline: Reels }
  | { state: "provider_succeeded"; version: number; url: string; leaseOwner: string; pipeline: Reels }
  | { state: "reserved"; version: number; leaseOwner: string; pipeline: Reels };
export async function reserveThumbnailRegeneration(input: { pipelineId: string; userId: string; idempotencyKey: string; limit: number }): Promise<ThumbnailReservation> {
  return sequelize.transaction(async (transaction) => {
    const pipeline = await findOwnedPipelineForUpdate(input.pipelineId, input.userId, transaction);
    if (!pipeline.s3key || !pipeline.thumbnailUrl) throw new Error("Rendered reel thumbnail is unavailable");
    const existing = await ThumbnailGenerationRequest.findOne({ where: { pipelineId: input.pipelineId, idempotencyKey: input.idempotencyKey }, transaction, lock: transaction.LOCK.UPDATE });
    if (existing?.status === "completed") return { state: "completed" as const, version: existing.version, pipeline };
    if (existing?.status === "provider_succeeded" && existing.url) return { state: "provider_succeeded" as const, version: existing.version, url: existing.url, leaseOwner: existing.leaseOwner, pipeline };
    if (existing?.status === "submitted") { existing.status = "uncertain"; await existing.save({ transaction }); return { state: "uncertain" as const, version: existing.version, pipeline }; }
    if (existing?.status === "uncertain") return { state: "uncertain" as const, version: existing.version, pipeline };
    if (existing?.status === "abandoned") return { state: "consumed" as const, version: existing.version, pipeline };
    if (existing?.status === "reserved" && existing.leaseExpiresAt > new Date()) return { state: "running" as const, version: existing.version, pipeline };
    const activeCount = await ThumbnailGenerationRequest.count({ where: { pipelineId: input.pipelineId, status: { [Op.in]: ["reserved", "submitted", "provider_succeeded", "completed", "uncertain", "abandoned"] } }, transaction });
    if ((!existing || existing.status === "failed") && activeCount >= input.limit) throw new Error("Thumbnail regeneration limit reached");
    const version = existing?.version ?? pipeline.nextThumbnailVersion;
    const leaseOwner = randomUUID();
    if (existing) {
      existing.status = "reserved"; existing.leaseOwner = leaseOwner; existing.leaseExpiresAt = new Date(Date.now() + 5 * 60_000); existing.error = null;
      await existing.save({ transaction });
    } else {
      await ThumbnailGenerationRequest.create({ pipelineId: input.pipelineId, userId: input.userId, idempotencyKey: input.idempotencyKey, version, status: "reserved", leaseOwner, leaseExpiresAt: new Date(Date.now() + 5 * 60_000), url: null, error: null }, { transaction });
      pipeline.nextThumbnailVersion = version + 1;
    }
    await pipeline.save({ transaction });
    return { state: "reserved" as const, version, leaseOwner, pipeline };
  });
}

export async function markThumbnailRegenerationSubmitted(pipelineId: string, userId: string, idempotencyKey: string, leaseOwner: string) {
  const [count] = await ThumbnailGenerationRequest.update({ status: "submitted" }, { where: { pipelineId, userId, idempotencyKey, leaseOwner, status: "reserved" } });
  if (count !== 1) throw new Error("Thumbnail reservation ownership was lost");
}
export async function saveThumbnailRegenerationProviderResult(pipelineId: string, userId: string, idempotencyKey: string, leaseOwner: string, url: string) {
  const [count] = await ThumbnailGenerationRequest.update({ status: "provider_succeeded", url }, { where: { pipelineId, userId, idempotencyKey, leaseOwner, status: "submitted" } });
  if (count !== 1) throw new Error("Thumbnail provider result ownership was lost");
}
export async function markThumbnailRegenerationUncertain(pipelineId: string, userId: string, idempotencyKey: string, leaseOwner: string, error: string) {
  await ThumbnailGenerationRequest.update({ status: "uncertain", error }, { where: { pipelineId, userId, idempotencyKey, leaseOwner, status: "submitted" } });
}
export async function completeThumbnailRegeneration(input: { pipelineId: string; userId: string; idempotencyKey: string; leaseOwner: string }) {
  return sequelize.transaction(async (transaction) => {
    const pipeline = await findOwnedPipelineForUpdate(input.pipelineId, input.userId, transaction);
    const request = await ThumbnailGenerationRequest.findOne({ where: { pipelineId: input.pipelineId, userId: input.userId, idempotencyKey: input.idempotencyKey }, transaction, lock: transaction.LOCK.UPDATE });
    if (!request || request.status !== "provider_succeeded" || request.leaseOwner !== input.leaseOwner || !request.url) throw new Error("Thumbnail provider result is unavailable");
    const versions = pipeline.thumbnailVersions ?? [];
    if (!versions.some((item) => item.version === request.version)) pipeline.thumbnailVersions = [...versions, { version: request.version, url: request.url, artifactKey: `thumbnail:${request.id}` }];
    pipeline.thumbnailUrl = request.url; pipeline.selectedThumbnailVersion = request.version;
    request.status = "completed";
    await pipeline.save({ transaction }); await request.save({ transaction }); return pipeline;
  });
}

export async function failThumbnailRegeneration(pipelineId: string, userId: string, idempotencyKey: string, leaseOwner: string, error: string) {
  await ThumbnailGenerationRequest.update({ status: "failed", error }, { where: { pipelineId, userId, idempotencyKey, leaseOwner, status: "reserved" } });
}

export async function selectThumbnailVersion(pipelineId: string, userId: string, version: number) {
  return sequelize.transaction(async (transaction) => {
    const pipeline = await findOwnedPipelineForUpdate(pipelineId, userId, transaction);
    const selected = pipeline.thumbnailVersions?.find((item) => item.version === version);
    if (!selected || !selected.url) throw new Error("Completed thumbnail version not found");
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
