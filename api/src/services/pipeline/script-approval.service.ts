import client from "../../configs/llm.config";
import { ScriptOutputSchema } from "../../schema/script-writer.schema";
import { StoryScriptOutputSchema } from "../../schema/story.schema";
import { ListScriptOutputSchema } from "../../schema/list.schema";
import { approveCurrentScript, completeAiScriptRevision, failAiScriptRevision, findPipelineById, replaceReviewableScript, reserveAiScriptRevision } from "../../repositories/reels.repository";
import { resolveServerGenerationAccess, type ResolvedGenerationEntitlement } from "./entitlement-resolution.service";
import { ApiError } from "../../utils/ApiError.util";
import { createProviderBudgetContext } from "./provider-budget.service";
import { meteredAnthropicCall, type MeteringContext } from "./llm-metering";
import { providerCallBudget } from "./budget-policy.service";
import { estimateInputTokenReservation } from "../../helpers/phase2-budget.helper";
import { getPipelineCostSummary } from "../../repositories/provider-usage.repository";
import { savePipelineCost } from "../../repositories/reels.repository";
import { validateListScript, validateStoryScript } from "../../helpers/phase3-content-validation.helper";
import { createExplainerDurationPolicy } from "./explainer-duration-policy.service";

const schemas = { explainer: ScriptOutputSchema, story: StoryScriptOutputSchema, list: ListScriptOutputSchema } as const;

export interface ScriptRevisionGenerator {
  revise(input: { script: object; instruction: string; videoType: keyof typeof schemas; model: string; metering?: MeteringContext }): Promise<object>;
}

export const bedrockScriptRevisionGenerator: ScriptRevisionGenerator = {
  async revise(input) {
    const messages = [{ role: "user" as const, content: JSON.stringify({ instruction: input.instruction, script: input.script }) }];
    const system = "Revise the supplied Nepali reel script according to the instruction. Preserve its exact JSON schema and return JSON only.";
    const response = await meteredAnthropicCall(input.metering, "script_revision", input.model, () => client.messages.create({
      model: input.model,
      max_tokens: 8192,
      system,
      messages,
    }, { maxRetries: 0 }), providerCallBudget({ inputTokens: estimateInputTokenReservation(system, messages), outputTokens: 8192, aiRevisions: 1 }));
    const text = response.content.find((part) => part.type === "text")?.text;
    if (!text) throw new Error("Revision model returned no JSON");
    return JSON.parse(text.replace(/^```json\s*|\s*```$/g, ""));
  },
};

function validateScript(videoType: keyof typeof schemas, script: unknown, pipeline: { contentInput: object; }, access: ResolvedGenerationEntitlement) {
  const parsed = schemas[videoType].parse(script);
  const maximum = createExplainerDurationPolicy(access).promptDuration.maximumDurationSeconds;
  if (videoType === "story") {
    const storyInput = (pipeline.contentInput as { storyInput: Parameters<typeof validateStoryScript>[0] }).storyInput;
    validateStoryScript(storyInput, parsed as Parameters<typeof validateStoryScript>[1], maximum);
  } else if (videoType === "list") {
    const listInput = (pipeline.contentInput as { listInput: Parameters<typeof validateListScript>[0] }).listInput;
    validateListScript(listInput, parsed as Parameters<typeof validateListScript>[1], maximum);
  } else createExplainerDurationPolicy(access).validateScript(parsed as Parameters<ReturnType<typeof createExplainerDurationPolicy>["validateScript"]>[0]);
  return parsed as object;
}

function assertEditable(access: ResolvedGenerationEntitlement) {
  if (!access.entitlement.manualScriptEditing) throw new ApiError(403, "Script editing is not available", "Forbidden");
}

export async function editScriptService(userId: string, pipelineId: string, input: { expectedVersion: number; script: unknown }) {
  const access = await resolveServerGenerationAccess(userId);
  assertEditable(access);
  const pipeline = await findPipelineById(pipelineId, userId);
  if (!pipeline) throw new ApiError(404, "Pipeline not found", "Not found");
  const script = validateScript(pipeline.videoType, input.script, pipeline, access);
  return replaceReviewableScript({ pipelineId, userId, expectedVersion: input.expectedVersion, script });
}

export async function reviseScriptService(
  userId: string,
  pipelineId: string,
  input: { expectedVersion: number; instruction: string; idempotencyKey: string },
  generator: ScriptRevisionGenerator = bedrockScriptRevisionGenerator,
) {
  const access = await resolveServerGenerationAccess(userId);
  const reservation = await reserveAiScriptRevision({ pipelineId, userId, idempotencyKey: input.idempotencyKey, expectedVersion: input.expectedVersion, limit: access.entitlement.aiRevisionsPerVideo });
  if (reservation.state === "completed") return findPipelineById(pipelineId, userId);
  if (reservation.state === "running") throw new ApiError(409, "Revision is already running", "Conflict");
  const metering: MeteringContext = { userId, pipelineId, stage: "script_revision", budget: createProviderBudgetContext(pipelineId, access) };
  try {
  const current = await findPipelineById(pipelineId, userId);
  if (!current) throw new ApiError(404, "Pipeline not found", "Not found");
  const revised = validateScript(reservation.videoType, await generator.revise({
    script: reservation.script,
    instruction: input.instruction,
    videoType: reservation.videoType,
    model: reservation.model,
    metering,
  }), current, access);
  const result = await completeAiScriptRevision({ pipelineId, userId, idempotencyKey: input.idempotencyKey, expectedVersion: reservation.scriptVersion, script: revised });
  const summary = await getPipelineCostSummary(pipelineId, userId);
  await savePipelineCost(pipelineId, userId, summary.knownCostUsd, true);
  return result;
  } catch (error) { await failAiScriptRevision(pipelineId, userId, input.idempotencyKey); throw error; }
}

export async function approveScriptService(userId: string, pipelineId: string, expectedVersion: number) {
  await resolveServerGenerationAccess(userId);
  return approveCurrentScript(pipelineId, userId, expectedVersion);
}

export async function getEntitlementsService(userId: string) {
  const access = await resolveServerGenerationAccess(userId);
  return { accessKind: access.accessKind, plan: access.entitlement };
}
