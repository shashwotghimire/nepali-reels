import { Op, type Transaction } from "sequelize";
import sequelize from "../configs/db.config";
import Reels from "../models/reels.model";
import WorkflowStageAttempt from "../models/workflow-stage-attempt.model";
import { ScriptOutput } from "../schema/script-writer.schema";
import { VideoSpec } from "../schema/video-spec.schema";
import { PipelineStatus } from "../types/pipeline.types";
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
    ) {
      throw new WorkflowLeaseLostError();
    }
    await mutate(pipeline, transaction);
    await pipeline.save({ transaction });
  });
}

export const createPipeline = (
  userId: string,
  topic: string,
  claudeModel: string,
  videoModel: string,
  ttsVoice?: string,
) => {
  return Reels.create({
    userId,
    topic,
    claudeModel,
    videoModel,
    ttsVoice: ttsVoice ?? "aoede",
    pipelineStatus: "queued",
  });
};

export const saveDraftScript = async (
  pipelineId: string,
  userId: string,
  draftScript: ScriptOutput,
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
  finalScript: ScriptOutput,
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
  finalScript: ScriptOutput,
  lease?: WorkflowLeaseWriteFence,
) => {
  await mutatePipelineWithLease(pipelineId, userId, lease, (pipeline) => {
    pipeline.finalScript = finalScript;
    pipeline.pipelineStatus = "linguistic_reviewed";
  });
};

export const saveVideoSpec = async (
  pipelineId: string,
  userId: string,
  videoSpec: VideoSpec,
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
  });
};

export const publishToTiktok = async (
  pipelineId: string,
  userId: string,
  tiktokPublishId: string,
  lease?: WorkflowLeaseWriteFence,
) => {
  await mutatePipelineWithLease(pipelineId, userId, lease, (pipeline) => {
    pipeline.tiktokPublishId = tiktokPublishId;
    pipeline.pipelineStatus = "publish_pending";
  });
};

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
