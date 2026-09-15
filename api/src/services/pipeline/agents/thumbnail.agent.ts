import client from "../../../configs/llm.config";
import { openRouterClient } from "../../../configs/openrouter.config";
import { THUMBNAIL_AGENT_SYSTEM_PROMPT } from "../../../llm/thumbnail.prompt";
import type { VideoSpec } from "../../../schema/video-spec.schema";
import type { AgentResult } from "../../../types/usage.types";
import { randomUUID } from "crypto";
import { beginProviderAttempt, finishProviderAttempt } from "../../../repositories/provider-usage.repository";
import { estimateImageCost } from "../../../utils/cost.util";
import { meteredAnthropicCall, type MeteringContext } from "../llm-metering";
import { estimateInputTokenReservation } from "../../../helpers/phase2-budget.helper";
import { providerCallBudget } from "../budget-policy.service";

export const generateThumbnailOpenRouter = async (
  videoSpec: VideoSpec,
  model: string,
  imageModel: string,
  context?: MeteringContext,
): Promise<AgentResult<Buffer>> => {
  const promptResponse = await meteredAnthropicCall(context, "thumbnail_prompt", model,
    () => client.messages.create({
    model,
    max_tokens: 512,
    system: THUMBNAIL_AGENT_SYSTEM_PROMPT,
    messages: [
      {
        role: "user",
        content: `Generate a thumbnail prompt for this video.\n\nThumbnail text: ${videoSpec.thumbnailText}\n\nScript summary:\n${videoSpec.scenes.map((s) => s.captionText).join(" ")}`,
      },
    ],
    }, { maxRetries: 0 }), providerCallBudget({
      inputTokens: estimateInputTokenReservation(THUMBNAIL_AGENT_SYSTEM_PROMPT, videoSpec),
      outputTokens: 512,
    }));

  const imagePrompt = promptResponse.content
    .filter((b) => b.type === "text")
    .map((b) => b.text)
    .join("");

  if (!imagePrompt) throw new Error("Thumbnail prompt generation failed");

  const imageAttemptId = randomUUID();
  const imageReservation = context?.budget
    ? await context.budget.reserve(imageAttemptId, 1, providerCallBudget())
    : undefined;
  if (context) {
    try {
      await beginProviderAttempt({ attemptId: imageAttemptId,
        userId: context.userId, pipelineId: context.pipelineId, operation: "thumbnail_image",
        stage: context.stage, provider: "openrouter", model: imageModel,
        configuration: { aspectRatio: "9:16", outputFormat: "jpeg" } });
    } catch (error) {
      if (imageReservation) await context.budget!.releaseBeforeStart(imageReservation);
      throw error;
    }
  }
  let result;
  try {
    result = await openRouterClient.images.generate({
    imageGenerationRequest: {
      model: imageModel,
      prompt: imagePrompt,
      aspectRatio: "9:16",
      outputFormat: "jpeg",
    },
    });
  } catch (error) {
    if (context) await finishProviderAttempt({ attemptId: imageAttemptId, status: "failed",
      costUsd: null, costProvenance: "unknown", error: String(error) });
    if (imageReservation) await context!.budget!.finalize(imageReservation, { providerCalls: 1 });
    throw error;
  }
  const b64 = (result as { data?: { b64Json: string }[] }).data?.[0]?.b64Json;
  if (!b64) {
    if (context) await finishProviderAttempt({ attemptId: imageAttemptId, status: "failed",
      costUsd: null, costProvenance: "unknown", error: "OpenRouter image response missing data" });
    if (imageReservation) await context!.budget!.finalize(imageReservation, { providerCalls: 1 });
    throw new Error("[thumbnail] OpenRouter image generation returned no data");
  }
  const imageCost = estimateImageCost(720, 1280, imageModel);
  if (context) await finishProviderAttempt({ attemptId: imageAttemptId, status: "succeeded",
    usage: { imageCount: 1, imageUsage: { widthPx: 720, heightPx: 1280, outputFormat: "jpeg" } },
    costUsd: imageCost === null ? null : imageCost.toString(),
    costProvenance: imageCost === null ? "unknown" : "estimated",
    rateVersion: imageCost === null ? null : "planning-2026-09-14" });
  if (imageReservation) await context!.budget!.finalize(imageReservation, { providerCalls: 1 });

  return {
    data: Buffer.from(b64, "base64"),
    usage: {
      inputTokens: promptResponse.usage.input_tokens,
      outputTokens: promptResponse.usage.output_tokens,
      cacheWriteTokens: promptResponse.usage.cache_creation_input_tokens ?? 0,
      cacheReadTokens: promptResponse.usage.cache_read_input_tokens ?? 0,
    },
  };
};
