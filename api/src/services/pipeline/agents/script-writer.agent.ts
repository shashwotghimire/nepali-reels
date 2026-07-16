import type { MessageParam } from "@anthropic-ai/sdk/resources";
import client from "../../../configs/llm.config";
import { ScriptOutputSchema } from "../../../schema/script-writer.schema";
import { zodOutputFormat } from "@anthropic-ai/sdk/helpers/zod";
import { tavliySearchTool } from "../../../tools/tavily-search.tool";
import { runTavilySearch } from "../../../configs/tavily.config";
import { FACT_CHECK_RUNS } from "../../../constants/constant";
import { scriptWriterPrompt } from "../../../llm/script-writer.prompt";

export const scriptGeneratorAgent = async (topic: string) => {
  const today = new Date().toISOString().split("T")[0] ?? "";
  const messages: MessageParam[] = [{ role: "user", content: topic }];

  try {
    for (let i = 0; i < FACT_CHECK_RUNS; i++) {
      const response = await client.messages.parse({
        model: `${process.env.AWS_SONNET_MODEL}`,
        max_tokens: 4096,
        system: scriptWriterPrompt(today),
        tools: [tavliySearchTool],
        output_config: {
          format: zodOutputFormat(ScriptOutputSchema),
        },
        messages,
      });

      messages.push({ role: "assistant", content: response.content });

      const toolUses = response.content.filter((b) => b.type === "tool_use");
      if (toolUses.length === 0) {
        if (!response.parsed_output)
          throw new Error("Script writer returned null output");
        return response.parsed_output;
      }

      const toolCallResults = await Promise.all(
        toolUses.map(async (tool) => {
          if (tool.name !== "tavily_search") {
            throw new Error(`Unexpected tool call: ${tool.name}`);
          }
          const results = await runTavilySearch(
            (tool.input as { query: string }).query,
          );
          return {
            type: "tool_result" as const,
            tool_use_id: tool.id,
            content: JSON.stringify(results),
          };
        }),
      );

      messages.push({ role: "user", content: toolCallResults });
    }

    throw new Error(
      `Script generator didn't finish within ${FACT_CHECK_RUNS} runs`,
    );
  } catch (error) {
    throw new Error(
      `scriptGeneratorAgent failed: ${error instanceof Error ? error.message : String(error)}`,
    );
  }
};
