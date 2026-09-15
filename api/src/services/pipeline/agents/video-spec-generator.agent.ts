import client from "../../../configs/llm.config";
import { VideoSpecSchema, type VideoSpec } from "../../../schema/video-spec.schema";
import { zodOutputFormat } from "@anthropic-ai/sdk/helpers/zod";
import { ScriptOutput } from "../../../schema/script-writer.schema";
import { videoSpecPrompt } from "../../../llm/video-spec.prompt";
import type { AgentResult } from "../../../types/usage.types";
import { meteredAnthropicCall, type MeteringContext } from "../llm-metering";
import { extractLlmUsage } from "../../../helpers/usage.helper";
import { estimateInputTokenReservation } from "../../../helpers/phase2-budget.helper";
import { providerCallBudget } from "../budget-policy.service";

export const videoSpecGeneratorAgent = async (
  script: ScriptOutput,
  model: string,
  context?: MeteringContext,
  duration?: { targetDurationSeconds: number; maximumDurationSeconds: number },
): Promise<AgentResult<VideoSpec>> => {
  const today = new Date().toISOString().split("T")[0] ?? "";
  const prompt = videoSpecPrompt(
    today,
    duration?.targetDurationSeconds,
    duration?.maximumDurationSeconds,
  );
  const response = await meteredAnthropicCall(context, "video-spec-generator", model, () => client.messages.parse({
    model,
    max_tokens: 8192,
    system: prompt,
    output_config: {
      format: zodOutputFormat(VideoSpecSchema),
    },
    messages: [
      {
        role: "user",
        content: `Final script:\n ${JSON.stringify(script)}`,
      },
    ],
  }, { maxRetries: 0 }), providerCallBudget({
    inputTokens: estimateInputTokenReservation(prompt, script),
    outputTokens: 8_192,
  }));
  if (!response.parsed_output) {
    throw new Error("Video spec generator failed");
  }
  return {
    data: response.parsed_output,
    usage: extractLlmUsage(response),
  };
};
