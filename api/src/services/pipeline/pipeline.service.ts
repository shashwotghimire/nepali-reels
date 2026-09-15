import { randomUUID } from "node:crypto";
import { STANDARD_GENERATION } from "../../commercial/policy";
import {
  createPipeline,
  findPipelineById,
  resetPipelineForRetry,
} from "../../repositories/reels.repository";
import type { PipelineStatus } from "../../types/pipeline.types";
import { ApiError } from "../../utils/ApiError.util";
import { inferLegacyCompletedStages } from "../../helpers/workflow.helper";
import { runExplainerWorkflow } from "./explainer-workflow.service";
import { resolveLegacyCompatibilityAccess } from "./entitlement-resolution.service";

/** New pipelines use the centrally configured standard generation models. */
export const initPipelineService = async (
  userId: string,
  topic: string,
  _model?: string,
  _videoModel?: string,
  ttsVoice?: string,
) => createPipeline(
  userId,
  topic,
  STANDARD_GENERATION.scriptModel,
  STANDARD_GENERATION.videoModel,
  ttsVoice,
);

export { markPipelineAsFailedService } from "./pipeline-failure.service";

export const dispatchPipelineService = (
  userId: string,
  pipelineId: string,
  executionKey: string,
  autoPublish = false,
) => runExplainerWorkflow({
  userId,
  pipelineId,
  executionKey,
  autoPublish,
  access: resolveLegacyCompatibilityAccess(userId),
});

export const createPipelineService = async (
  userId: string,
  pipelineId: string,
  _topic?: string,
  _model?: string,
  _videoModel?: string,
  autoPublish = false,
  _ttsVoice?: string,
  executionKey = randomUUID(),
) => dispatchPipelineService(userId, pipelineId, executionKey, autoPublish);

export const resumePipelineService = async (
  userId: string,
  pipelineId: string,
  _resumeFrom?: PipelineStatus,
  executionKey = randomUUID(),
) => dispatchPipelineService(userId, pipelineId, executionKey);

export const retryPipelineService = async (
  userId: string,
  pipelineId: string,
) => {
  const pipeline = await findPipelineById(pipelineId, userId);
  if (!pipeline) throw new ApiError(404, "Pipeline not found", "Not found");
  if (pipeline.pipelineStatus !== "failed") {
    throw new ApiError(400, "Pipeline is not in failed state", "Cannot retry");
  }

  const completed = inferLegacyCompletedStages(pipeline);
  const resumeFrom: PipelineStatus = completed.includes("audio")
    ? "sound_generated"
    : completed.includes("video_spec")
      ? "video_spec_generated"
      : completed.includes("fact_check")
        ? "script_finalised"
        : completed.includes("script")
          ? "script_generated"
          : "queued";
  await resetPipelineForRetry(pipelineId, userId, resumeFrom);
  return { resumeFrom, pipelineId };
};
