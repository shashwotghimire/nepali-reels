import {
  LIST_STAGES,
  LIST_WORKFLOW_VERSION,
  STORY_STAGES,
  STORY_WORKFLOW_VERSION,
  type WorkflowStage,
} from "../../helpers/workflow.helper";
import {
  findPipelineById,
  saveDraftScript,
  saveFinalScript,
  savePipelineCost,
  saveVideoSpec,
} from "../../repositories/reels.repository";
import { getPipelineCostSummary } from "../../repositories/provider-usage.repository";
import { ListInputSchema, type ListScriptOutput, type ListVideoSpec } from "../../schema/list.schema";
import { StoryInputSchema, type StoryScriptOutput, type StoryVideoSpec } from "../../schema/story.schema";
import { ApiError } from "../../utils/ApiError.util";
import { createProviderBudgetContext } from "./provider-budget.service";
import { createExplainerDurationPolicy } from "./explainer-duration-policy.service";
import type { ResolvedGenerationEntitlement } from "./entitlement-resolution.service";
import type { MeteringContext } from "./llm-metering";
import { createWorkflowCheckpointPort } from "./workflow-checkpoint.service";
import { dispatchWorkflow, type WorkflowStageLease } from "./workflow-dispatcher.service";
import {
  listReviewAgent,
  listScriptGeneratorAgent,
  listVideoSpecGeneratorAgent,
} from "./agents/list.agent";
import {
  storyReviewAgent,
  storyScriptGeneratorAgent,
  storyVideoSpecGeneratorAgent,
} from "./agents/story.agent";
import {
  validateListScript,
  validateListVideoSpec,
  validateStoryScript,
  validateStoryVideoSpec,
} from "../../helpers/phase3-content-validation.helper";
import {
  executeSharedProductionStage,
  type ProductionVideoSpec,
  type PublicationMetadata,
} from "./shared-production-stage.service";

interface WorkflowInput {
  userId: string;
  pipelineId: string;
  executionKey: string;
  leaseOwner: string;
  autoPublish: boolean;
  access: ResolvedGenerationEntitlement;
}

async function syncCost(input: WorkflowInput, lease: WorkflowStageLease) {
  const summary = await getPipelineCostSummary(input.pipelineId, input.userId);
  await savePipelineCost(
    input.pipelineId, input.userId, summary.knownCostUsd, true, lease,
  );
}

function requirePublication(script: unknown): PublicationMetadata {
  const value = script as Partial<PublicationMetadata> | null;
  if (!value || !Array.isArray(value.titleOptions) || !Array.isArray(value.hashtags)) {
    throw new Error("Final script is unavailable for publishing");
  }
  return { titleOptions: value.titleOptions, hashtags: value.hashtags };
}

async function runStoryWorkflow(input: WorkflowInput) {
  const initial = await findPipelineById(input.pipelineId, input.userId);
  if (!initial) throw new ApiError(404, "Pipeline not found", "Not found");
  if (initial.videoType !== "story" || initial.workflowVersion !== STORY_WORKFLOW_VERSION) {
    throw new Error(`Unsupported story workflow version ${initial.workflowVersion}`);
  }
  const persistedInput = initial.contentInput as { storyInput?: unknown };
  const storyInput = StoryInputSchema.parse(persistedInput.storyInput);
  const durationPolicy = createExplainerDurationPolicy(input.access);
  const budget = createProviderBudgetContext(input.pipelineId, input.access);
  const metering: MeteringContext = {
    userId: input.userId,
    pipelineId: input.pipelineId,
    stage: "",
    budget,
  };
  const load = async () => {
    const pipeline = await findPipelineById(input.pipelineId, input.userId);
    if (!pipeline) throw new Error("Reel not found");
    return pipeline;
  };

  await dispatchWorkflow({
    pipelineId: input.pipelineId,
    userId: input.userId,
    executionKey: input.executionKey,
    workflowVersion: STORY_WORKFLOW_VERSION,
    stages: STORY_STAGES,
    checkpoints: createWorkflowCheckpointPort(input.executionKey, input.leaseOwner),
    executor: {
      async execute(stage, outputs, lease) {
        if (!lease) throw new Error(`Workflow stage ${stage} has no active lease`);
        metering.stage = stage;
        metering.lease = lease;
        const pipeline = await load();
        switch (stage) {
          case "story_script": {
            const result = await storyScriptGeneratorAgent(
              pipeline.topic, storyInput, pipeline.claudeModel, metering,
              durationPolicy.promptDuration,
            );
            validateStoryScript(storyInput, result.data, durationPolicy.promptDuration.maximumDurationSeconds);
            await saveDraftScript(input.pipelineId, input.userId, result.data, lease);
            await syncCost(input, lease);
            return { persisted: "draftScript" };
          }
          case "story_continuity": {
            const draft = pipeline.draftScript as StoryScriptOutput | null;
            if (!draft) throw new Error("Story draft checkpoint has no script");
            validateStoryScript(storyInput, draft, durationPolicy.promptDuration.maximumDurationSeconds);
            return { treatment: storyInput.treatment, continuityValidated: true };
          }
          case "story_fact_safety": {
            const draft = pipeline.draftScript as StoryScriptOutput | null;
            if (!draft) throw new Error("Story draft checkpoint has no script");
            const { data: review } = await storyReviewAgent(
              storyInput, draft, pipeline.claudeModel, metering,
            );
            await syncCost(input, lease);
            if (review.verdict === "unsafe") {
              throw new ApiError(400, `Story is unsafe: ${JSON.stringify(review.issues)}`, "Story is not safe.");
            }
            const finalScript = review.verdict === "revise" ? review.revisedScript : draft;
            if (!finalScript) throw new Error("Story reviewer omitted its revision");
            validateStoryScript(storyInput, finalScript, durationPolicy.promptDuration.maximumDurationSeconds);
            await saveFinalScript(input.pipelineId, input.userId, finalScript, lease);
            return { persisted: "finalScript", treatment: storyInput.treatment };
          }
          case "story_video_spec": {
            const finalScript = pipeline.finalScript as StoryScriptOutput | null;
            if (!finalScript) throw new Error("Story review checkpoint has no final script");
            const { data: videoSpec } = await storyVideoSpecGeneratorAgent(
              storyInput, finalScript, pipeline.claudeModel, metering,
              durationPolicy.promptDuration,
            );
            validateStoryVideoSpec(storyInput, videoSpec, durationPolicy.promptDuration.maximumDurationSeconds);
            durationPolicy.validateVideoSpec(videoSpec);
            await saveVideoSpec(input.pipelineId, input.userId, videoSpec, lease);
            await syncCost(input, lease);
            return { persisted: "videoSpec" };
          }
          default: {
            const videoSpec = pipeline.videoSpec as StoryVideoSpec | null;
            if (!videoSpec) throw new Error("Story video specification is unavailable");
            return executeSharedProductionStage({
              stage,
              outputs,
              lease,
              pipeline,
              userId: input.userId,
              pipelineId: input.pipelineId,
              workflowVersion: STORY_WORKFLOW_VERSION,
              autoPublish: input.autoPublish,
              metering,
              durationPolicy,
              videoSpec: videoSpec as ProductionVideoSpec,
              publication: requirePublication(pipeline.finalScript),
            });
          }
        }
      },
    },
  });
  return load();
}

async function runListWorkflow(input: WorkflowInput) {
  const initial = await findPipelineById(input.pipelineId, input.userId);
  if (!initial) throw new ApiError(404, "Pipeline not found", "Not found");
  if (initial.videoType !== "list" || initial.workflowVersion !== LIST_WORKFLOW_VERSION) {
    throw new Error(`Unsupported list workflow version ${initial.workflowVersion}`);
  }
  const persistedInput = initial.contentInput as { listInput?: unknown };
  const listInput = ListInputSchema.parse(persistedInput.listInput);
  const durationPolicy = createExplainerDurationPolicy(input.access);
  const budget = createProviderBudgetContext(input.pipelineId, input.access);
  const metering: MeteringContext = {
    userId: input.userId,
    pipelineId: input.pipelineId,
    stage: "",
    budget,
  };
  const load = async () => {
    const pipeline = await findPipelineById(input.pipelineId, input.userId);
    if (!pipeline) throw new Error("Reel not found");
    return pipeline;
  };

  await dispatchWorkflow({
    pipelineId: input.pipelineId,
    userId: input.userId,
    executionKey: input.executionKey,
    workflowVersion: LIST_WORKFLOW_VERSION,
    stages: LIST_STAGES,
    checkpoints: createWorkflowCheckpointPort(input.executionKey, input.leaseOwner),
    executor: {
      async execute(stage, outputs, lease) {
        if (!lease) throw new Error(`Workflow stage ${stage} has no active lease`);
        metering.stage = stage;
        metering.lease = lease;
        const pipeline = await load();
        switch (stage) {
          case "list_script": {
            const result = await listScriptGeneratorAgent(
              pipeline.topic, listInput, pipeline.claudeModel, metering,
              durationPolicy.promptDuration,
            );
            validateListScript(listInput, result.data, durationPolicy.promptDuration.maximumDurationSeconds);
            await saveDraftScript(input.pipelineId, input.userId, result.data, lease);
            await syncCost(input, lease);
            return { persisted: "draftScript" };
          }
          case "list_structure": {
            const draft = pipeline.draftScript as ListScriptOutput | null;
            if (!draft) throw new Error("List draft checkpoint has no script");
            validateListScript(listInput, draft, durationPolicy.promptDuration.maximumDurationSeconds);
            return { itemCount: listInput.itemCount, order: listInput.order, structureValidated: true };
          }
          case "list_fact_check": {
            const draft = pipeline.draftScript as ListScriptOutput | null;
            if (!draft) throw new Error("List draft checkpoint has no script");
            const { data: review } = await listReviewAgent(
              listInput, draft, pipeline.claudeModel, metering,
            );
            await syncCost(input, lease);
            if (review.verdict === "unsafe") {
              throw new ApiError(400, `List is unsafe: ${JSON.stringify(review.issues)}`, "List is not safe.");
            }
            const finalScript = review.verdict === "revise" ? review.revisedScript : draft;
            if (!finalScript) throw new Error("List reviewer omitted its revision");
            validateListScript(listInput, finalScript, durationPolicy.promptDuration.maximumDurationSeconds);
            await saveFinalScript(input.pipelineId, input.userId, finalScript, lease);
            return { persisted: "finalScript", itemCount: listInput.itemCount };
          }
          case "list_video_spec": {
            const finalScript = pipeline.finalScript as ListScriptOutput | null;
            if (!finalScript) throw new Error("List review checkpoint has no final script");
            const { data: videoSpec } = await listVideoSpecGeneratorAgent(
              listInput, finalScript, pipeline.claudeModel, metering,
              durationPolicy.promptDuration,
            );
            validateListVideoSpec(listInput, videoSpec, durationPolicy.promptDuration.maximumDurationSeconds);
            durationPolicy.validateVideoSpec(videoSpec);
            await saveVideoSpec(input.pipelineId, input.userId, videoSpec, lease);
            await syncCost(input, lease);
            return { persisted: "videoSpec" };
          }
          default: {
            const videoSpec = pipeline.videoSpec as ListVideoSpec | null;
            if (!videoSpec) throw new Error("List video specification is unavailable");
            return executeSharedProductionStage({
              stage,
              outputs,
              lease,
              pipeline,
              userId: input.userId,
              pipelineId: input.pipelineId,
              workflowVersion: LIST_WORKFLOW_VERSION,
              autoPublish: input.autoPublish,
              metering,
              durationPolicy,
              videoSpec: videoSpec as ProductionVideoSpec,
              publication: requirePublication(pipeline.finalScript),
            });
          }
        }
      },
    },
  });
  return load();
}

export { runStoryWorkflow, runListWorkflow };
