import client from "../../../configs/llm.config";
import fs from "fs";
import path from "path";
import { VideoSpecSchema } from "../../../schema/video-spec.schema";
import { zodOutputFormat } from "@anthropic-ai/sdk/helpers/zod";
import { ScriptOutput } from "../../../schema/script-writer.schema";

const systemPrompt = fs.readFileSync(
  path.join(__dirname, "../../../llm/video-spec.prompt.md"),
  "utf-8",
);

export const videoSpecGeneratorAgent = async (script: ScriptOutput) => {
  const response = await client.messages.parse({
    model: `${process.env.AWS_SONNET_MODEL}`,
    max_tokens: 8192,
    system: systemPrompt,
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
