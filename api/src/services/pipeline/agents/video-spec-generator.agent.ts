import client from "../../../configs/llm.config";
import { VideoSpecSchema, type VideoSpec } from "../../../schema/video-spec.schema";
import { zodOutputFormat } from "@anthropic-ai/sdk/helpers/zod";
import { ScriptOutput } from "../../../schema/script-writer.schema";
import { videoSpecPrompt } from "../../../llm/video-spec.prompt";
import type { AgentResult } from "../../../types/usage.types";
import { meteredAnthropicCall, type MeteringContext } from "../llm-metering";
import { extractLlmUsage } from "../../../helpers/usage.helper";

export const videoSpecGeneratorAgent = async (
  script: ScriptOutput,
  model: string,
  context?: MeteringContext,
): Promise<AgentResult<VideoSpec>> => {
  const today = new Date().toISOString().split("T")[0] ?? "";
  const response = await meteredAnthropicCall(context, "video-spec-generator", model, () => client.messages.parse({
    model,
    max_tokens: 8192,
    system: videoSpecPrompt(today),
    output_config: {
      format: zodOutputFormat(VideoSpecSchema),
    },
    messages: [
      {
        role: "user",
        content: `Final script:\n ${JSON.stringify(script)}`,
      },
    ],
  }, { maxRetries: 0 }));
  if (!response.parsed_output) {
    throw new Error("Video spec generator failed");
  }
  return {
    data: response.parsed_output,
    usage: extractLlmUsage(response),
  };
};
