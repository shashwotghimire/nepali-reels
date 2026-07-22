import type { MessageParam } from "@anthropic-ai/sdk/resources";
import { zodOutputFormat } from "@anthropic-ai/sdk/helpers/zod";
import { z } from "zod";
import client from "../../../configs/llm.config";
import { improverPrompt } from "../../../llm/improver.prompt";
import { SuggestionsSchema, type Suggestions } from "../../../schema/analytics.schema";
import type { AnalyticsReport } from "../../../schema/analytics.schema";
import { tavliySearchTool } from "../../../tools/tavily-search.tool";
import { runTavilySearch } from "../../../configs/tavily.config";
import { FACT_CHECK_RUNS } from "../../../constants/constant";

const SuggestionsWrapperSchema = z.object({ suggestions: SuggestionsSchema });

export const improverAgent = async (
  report: AnalyticsReport,
  model: string,
): Promise<Suggestions> => {
  const messages: MessageParam[] = [
    { role: "user", content: JSON.stringify(report) },
  ];

  try {
    for (let i = 0; i < FACT_CHECK_RUNS; i++) {
      const response = await client.messages.parse({
        model,
        max_tokens: 2048,
        system: improverPrompt,
        tools: [tavliySearchTool],
        output_config: {
          format: zodOutputFormat(SuggestionsWrapperSchema),
        },
        messages,
      });

      messages.push({ role: "assistant", content: response.content });

      const toolUses = response.content.filter((b) => b.type === "tool_use");
      if (toolUses.length === 0) {
        if (!response.parsed_output) {
          throw new Error("Improver agent returned null output");
        }
        return response.parsed_output.suggestions;
      }

      const toolResults = await Promise.all(
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

      messages.push({ role: "user", content: toolResults });
    }

    throw new Error(
      `Improver agent didn't finish within ${FACT_CHECK_RUNS} runs`,
    );
  } catch (error) {
    throw new Error(
      `improverAgent failed: ${error instanceof Error ? error.message : String(error)}`,
    );
  }
};
