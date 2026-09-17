import { randomUUID } from "node:crypto";
import { STANDARD_GENERATION } from "../../commercial/policy";
import {
  createPipeline,
  findPipelineById,
  resetPipelineForRetry,
} from "../../repositories/reels.repository";
import type { PipelineContentInput, PipelineStatus, VideoType } from "../../types/pipeline.types";
import { ApiError } from "../../utils/ApiError.util";
import { inferLegacyCompletedStages } from "../../helpers/workflow.helper";
import { resolveServerGenerationAccess } from "./entitlement-resolution.service";
import { createWorkflowLeaseOwner } from "./workflow-checkpoint.service";
import { resolveStyleSnapshot } from "./channel-style.service";
import type { CaptionPreset } from "../../types/pipeline.types";

/** New pipelines use the centrally configured standard generation models. */
export const initPipelineService = async (
  userId: string,
  topic: string,
  _model?: string,
  _videoModel?: string,
  ttsVoice?: string,
  videoType: VideoType = "explainer",
  contentInput: PipelineContentInput = { videoType: "explainer" },
  captionPreset: CaptionPreset = "default",
  styleId?: string,
  autoPublishRequested = false,
) => {
  const access = await resolveServerGenerationAccess(userId);
  if (!access.entitlement.videoTypes.includes(videoType)) {
    throw new ApiError(403, `${videoType} is not available for this access`, "Forbidden");
  }
  const selectedVoice = access.entitlement.allSupportedVoices ? (ttsVoice ?? "aoede") : "aoede";
  const selectedCaptionPreset = access.entitlement.captionPresets ? captionPreset : "default";
  const style = await resolveStyleSnapshot(userId, styleId);
  return createPipeline(
    userId,
    topic,
    STANDARD_GENERATION.scriptModel,
    STANDARD_GENERATION.videoModel,
    selectedVoice,
    videoType,
    contentInput,
    style?.captionPreset ?? selectedCaptionPreset,
    style,
    autoPublishRequested,
  );
};

export { markPipelineAsFailedService } from "./pipeline-failure.service";

type WorkflowRunInput = {
  userId: string;
  pipelineId: string;
  executionKey: string;
  leaseOwner: string;
  autoPublish: boolean;
  access: Awaited<ReturnType<typeof resolveServerGenerationAccess>>;
};

interface WorkflowDispatchDependencies {
  findPipeline: typeof findPipelineById;
  runExplainer(input: WorkflowRunInput): Promise<unknown>;
  runStory(input: WorkflowRunInput): Promise<unknown>;
  runList(input: WorkflowRunInput): Promise<unknown>;
}

const workflowDispatchDependencies: WorkflowDispatchDependencies = {
  findPipeline: findPipelineById,
  runExplainer: async (input) => {
    const { runExplainerWorkflow } = await import("./explainer-workflow.service.js");
    return runExplainerWorkflow(input);
  },
  runStory: async (input) => {
    const { runStoryWorkflow } = await import("./structured-content-workflow.service.js");
    return runStoryWorkflow(input);
  },
  runList: async (input) => {
    const { runListWorkflow } = await import("./structured-content-workflow.service.js");
    return runListWorkflow(input);
  },
};

export const dispatchPipelineService = async (
  userId: string,
  pipelineId: string,
  executionKey: string,
  autoPublish = false,
  leaseOwner = createWorkflowLeaseOwner(executionKey),
  dependencies: WorkflowDispatchDependencies = workflowDispatchDependencies,
) => {
  const pipeline = await dependencies.findPipeline(pipelineId, userId);
  if (!pipeline) throw new ApiError(404, "Pipeline not found", "Not found");
  const access = await resolveServerGenerationAccess(userId);
  const workflowInput = {
    userId,
    pipelineId,
    executionKey,
    leaseOwner,
    autoPublish: autoPublish || pipeline.autoPublishRequested,
    access,
  };
  switch (pipeline.videoType) {
    case "explainer": {
      return dependencies.runExplainer(workflowInput);
    }
    case "story": {
      return dependencies.runStory(workflowInput);
    }
    case "list": {
      return dependencies.runList(workflowInput);
    }
    default:
      throw new Error(`Unsupported video type ${String(pipeline.videoType)}`);
  }
};

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

interface RetryPipelineDependencies {
  findPipeline: typeof findPipelineById;
  resetPipeline: typeof resetPipelineForRetry;
}

const retryPipelineDependencies: RetryPipelineDependencies = {
  findPipeline: findPipelineById,
  resetPipeline: resetPipelineForRetry,
};

export const retryPipelineService = async (
  userId: string,
  pipelineId: string,
  dependencies: RetryPipelineDependencies = retryPipelineDependencies,
) => {
  const pipeline = await dependencies.findPipeline(pipelineId, userId);
  if (!pipeline) throw new ApiError(404, "Pipeline not found", "Not found");
  if (pipeline.pipelineStatus !== "failed") {
    throw new ApiError(400, "Pipeline is not in failed state", "Cannot retry");
  }

  const completed = pipeline.videoType === "explainer"
    ? inferLegacyCompletedStages(pipeline)
    : [];
  const soundSpec = pipeline.soundSpec as { artifactKey?: string } | null;
  const resumeFrom: PipelineStatus = pipeline.tiktokPublishId
    ? "publish_pending"
    : pipeline.s3key
      ? "video_generated"
      : soundSpec?.artifactKey
        ? "sound_generated"
        : pipeline.videoSpec
          ? "video_spec_generated"
          : pipeline.finalScript
            ? "script_finalised"
            : pipeline.draftScript
              ? "script_generated"
              : completed.includes("publish")
                ? "publish_pending"
                : "queued";
  await dependencies.resetPipeline(pipelineId, userId, resumeFrom);
  return { resumeFrom, pipelineId };
};
