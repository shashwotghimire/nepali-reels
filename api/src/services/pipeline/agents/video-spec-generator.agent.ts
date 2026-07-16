import client from "../../../configs/llm.config";
import { VideoSpecSchema } from "../../../schema/video-spec.schema";
import { zodOutputFormat } from "@anthropic-ai/sdk/helpers/zod";
import { ScriptOutput } from "../../../schema/script-writer.schema";
import { videoSpecPrompt } from "../../../llm/video-spec.prompt";

export const videoSpecGeneratorAgent = async (script: ScriptOutput) => {
  const today = new Date().toISOString().split("T")[0] ?? "";
  const response = await client.messages.parse({
    model: `${process.env.AWS_SONNET_MODEL}`,
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
  return response.parsed_output;
};
