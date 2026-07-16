import { Op } from "sequelize";
import Reels from "../models/reels.model";
import { ScriptOutput } from "../schema/script-writer.schema";
import { VideoSpec } from "../schema/video-spec.schema";

export const createPipeline = (userId: string, topic: string) => {
  return Reels.create({
    userId,
    topic,
    pipelineStatus: "queued",
  });
};

export const saveDraftScript = async (
  pipelineId: string,
  userId: string,
  draftScript: ScriptOutput,
) => {
  const pipeline = await Reels.findOne({
    where: {
      id: pipelineId,
      userId,
    },
  });
  if (!pipeline) {
    throw new Error("Reel not found");
  }
  pipeline.draftScript = draftScript;
  pipeline.pipelineStatus = "script_generated";
  await pipeline.save();
};

export const saveFinalScript = async (
  pipelineId: string,
  userId: string,
  finalScript: ScriptOutput,
) => {
  const pipeline = await Reels.findOne({
    where: {
      id: pipelineId,
      userId,
    },
  });
  if (!pipeline) {
    throw new Error("Reel not found");
  }
  pipeline.finalScript = finalScript;
  pipeline.pipelineStatus = "script_finalised";
  await pipeline.save();
};

export const saveVideoSpec = async (
  pipelineId: string,
  userId: string,
  videoSpec: VideoSpec,
) => {
  const pipeline = await Reels.findOne({
    where: {
      id: pipelineId,
      userId,
    },
  });
  if (!pipeline) {
    throw new Error("Reel not found");
  }
  pipeline.videoSpec = videoSpec;
  pipeline.pipelineStatus = "video_spec_generated";
  await pipeline.save();
};

export const saveAudioSpec = async (
  pipelineId: string,
  userId: string,
  soundSpec: any,
) => {
  const pipeline = await Reels.findOne({
    where: {
      id: pipelineId,
      userId,
    },
  });
  if (!pipeline) {
    throw new Error("Reel not found");
  }
  pipeline.soundSpec = soundSpec;
  pipeline.pipelineStatus = "sound_generated";
  await pipeline.save();
};

export const findPipelineById = (pipelineId: string, userId: string) => {
  return Reels.findOne({
    where: {
      id: pipelineId,
      userId,
    },
  });
};

export const findAllReelsOfUser = (
  userId: string,
  limit: number,
  offset: number,
  search?: string,
) => {
  const where: Record<string, unknown> = { userId };
  if (search) {
    where.topic = { [Op.iLike]: `%${search}%` };
  }
  return Reels.findAndCountAll({
    where,
    order: [["createdAt", "DESC"]],
    limit,
    offset,
  });
};
