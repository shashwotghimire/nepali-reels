import client from "../../../configs/llm.config";
import { VideoSpecSchema, type VideoSpec } from "../../../schema/video-spec.schema";
import { zodOutputFormat } from "@anthropic-ai/sdk/helpers/zod";
import { ScriptOutput } from "../../../schema/script-writer.schema";
import { videoSpecPrompt } from "../../../llm/video-spec.prompt";
import type { AgentResult } from "../../../types/usage.types";

export const videoSpecGeneratorAgent = async (
  script: ScriptOutput,
  model: string,
): Promise<AgentResult<VideoSpec>> => {
  const today = new Date().toISOString().split("T")[0] ?? "";
  const response = await client.messages.parse({
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
  });
  if (!response.parsed_output) {
    throw new Error("Video spec generator failed");
  }
  return {
    data: response.parsed_output,
    usage: {
      inputTokens: response.usage.input_tokens,
      outputTokens: response.usage.output_tokens,
      cacheWriteTokens: response.usage.cache_creation_input_tokens ?? 0,
      cacheReadTokens: response.usage.cache_read_input_tokens ?? 0,
    },
  };
};
