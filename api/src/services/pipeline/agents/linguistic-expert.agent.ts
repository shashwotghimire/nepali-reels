import type { MessageParam } from "@anthropic-ai/sdk/resources";
import client from "../../../configs/llm.config";
import { ScriptOutput } from "../../../schema/script-writer.schema";
import { zodOutputFormat } from "@anthropic-ai/sdk/helpers/zod";
import { LinguisticExpertOutputSchema } from "../../../schema/linguistic-expert.schema";
import { linguisticExpertPrompt } from "../../../llm/linguistic-expert.prompt";
import { tavliySearchTool } from "../../../tools/tavily-search.tool";
import { runTavilySearch } from "../../../configs/tavily.config";
import { FACT_CHECK_RUNS } from "../../../constants/constant";

export const linguisticExpertAgent = async (
  script: ScriptOutput,
  model: string,
) => {
  const messages: MessageParam[] = [
    {
      role: "user",
      content: `Review this script for natural spoken Nepali.\n${JSON.stringify(script)}`,
    },
  ];

  for (let i = 0; i < FACT_CHECK_RUNS; i++) {
    const response = await client.messages.parse({
      model,
      max_tokens: 4096,
      system: linguisticExpertPrompt,
      tools: [tavliySearchTool],
      output_config: {
        format: zodOutputFormat(LinguisticExpertOutputSchema),
      },
      messages,
    });
    messages.push({ role: "assistant", content: response.content });
    const toolUses = response.content.filter((b) => b.type === "tool_use");
    if (toolUses.length === 0) {
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
  throw new Error(`Linguistic expert agent didn't finish within ${FACT_CHECK_RUNS} runs`);
};
