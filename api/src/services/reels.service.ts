import {
  findAllReelsOfUser,
  findPipelineById,
  deletePipelineById,
} from "../repositories/reels.repository";
import { ApiError } from "../utils/ApiError.util";
import fs from "node:fs";
import path from "node:path";
import { restoreWorkflowFile } from "./pipeline/workflow-artifact.service";
import { findWorkflowStageAttempts } from "../repositories/workflow-execution.repository";
import { WORKFLOW_STAGES_BY_TYPE, type WorkflowStage } from "../helpers/workflow.helper";
import type { VideoType } from "../types/pipeline.types";

async function attachWorkflowProgress<T extends {
  id: string;
  userId: string;
  videoType: VideoType;
  workflowVersion: number;
}>(pipeline: T) {
  const attempts = await findWorkflowStageAttempts({
    pipelineId: pipeline.id,
    userId: pipeline.userId,
    workflowVersion: pipeline.workflowVersion,
  });
  const orderedStages = WORKFLOW_STAGES_BY_TYPE[pipeline.videoType] as readonly WorkflowStage[];
  const latest = new Map<string, (typeof attempts)[number]>();
  for (const attempt of attempts) latest.set(attempt.stage, attempt);
  const stages = orderedStages.map((stage) => ({
    stage,
    status: latest.get(stage)?.status ?? "pending",
  }));
  const active = stages.find((stage) => stage.status === "running" || stage.status === "failed")
    ?? stages.find((stage) => stage.status === "pending");
  return {
    orderedStages,
    currentStage: active?.stage ?? null,
    stages,
  };
}

export const getPipelineByIdService = async (
  userId: string,
  pipelineId: string,
) => {
  const pipeline = await findPipelineById(pipelineId, userId);
  if (!pipeline) {
    throw new ApiError(404, "Pipeline not found", "Pipeline not found");
  }
  const plain = pipeline.toJSON();
  return {
    ...plain,
    workflowProgress: await attachWorkflowProgress(plain),
  };
};

export const resolvePipelineAudioPathService = async (
  userId: string,
  pipelineId: string,
): Promise<string | null> => {
  const pipeline = await findPipelineById(pipelineId, userId);
  if (!pipeline) throw new ApiError(404, "Pipeline not found", "Pipeline not found");
  const audioPath = path.resolve(`src/audio/${pipelineId}.wav`);
  if (fs.existsSync(audioPath)) return audioPath;

  const soundSpec = pipeline.soundSpec as { artifactKey?: unknown } | null;
  if (typeof soundSpec?.artifactKey !== "string") return null;
  const restored = await restoreWorkflowFile({
    pipelineId,
    userId,
    artifactKey: soundSpec.artifactKey,
    destination: audioPath,
  });
  return restored ? audioPath : null;
};

export const deletePipelineService = async (userId: string, pipelineId: string) => {
  const pipeline = await findPipelineById(pipelineId, userId);
  if (!pipeline) {
    throw new ApiError(404, "Pipeline not found", "Pipeline not found");
  }
  await deletePipelineById(pipelineId, userId);
};

const buildVideoUrl = (s3key: string | null): string | null => {
  if (!s3key) return null;
  const domain = process.env.AWS_CLOUDFRONT_DOMAIN;
  if (domain) return `https://${domain}/${s3key}`;
  return null;
};

export const getReelsService = async (
  userId: string,
  page: number,
  limit: number,
  search?: string,
) => {
  const offset = (page - 1) * limit;
  const { rows, count } = await findAllReelsOfUser(
    userId,
    limit,
    offset,
    search,
  );
  const reels = rows.map((r) => ({
    ...r.toJSON(),
    videoUrl: buildVideoUrl(r.s3key),
  }));
  return {
    reels,
    totalItems: count,
    totalPages: Math.ceil(count / limit),
    currentPage: page,
  };
};
