import fs from "fs";
import path from "path";
import client from "../../../configs/llm.config";
import { ScriptOutputSchema } from "../../../schema/script-writer.schema";
import { zodOutputFormat } from "@anthropic-ai/sdk/helpers/zod";

const systemPrompt = fs.readFileSync(
  path.join(__dirname, "../../../llm/script-writer.prompt.md"),
  "utf-8",
);

export const scriptGeneratorAgent = async (topic: string) => {
  const response = await client.messages.parse({
    model: `${process.env.AWS_HAIKU_MODEL}`,
    max_tokens: 4096,
    system: systemPrompt,
    output_config: {
      format: zodOutputFormat(ScriptOutputSchema),
    },
    messages: [{ role: "user", content: `${topic}` }],
  });
  if (!response.parsed_output) throw new Error("Script writer returned null output");
  return response.parsed_output;
};
