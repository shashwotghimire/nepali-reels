import type { MessageParam } from "@anthropic-ai/sdk/resources";
import { zodOutputFormat } from "@anthropic-ai/sdk/helpers/zod";
import client from "../../../configs/llm.config";
import { improverPrompt } from "../../../llm/improver.prompt";
import { ImproverOutputSchema, type ImproverOutput } from "../../../schema/analytics.schema";
import type { AnalyticsReport } from "../../../schema/analytics.schema";
import { tavliySearchTool } from "../../../tools/tavily-search.tool";
import { runTavilySearch } from "../../../configs/tavily.config";
import { FACT_CHECK_RUNS } from "../../../constants/constant";
import { meteredAnthropicCall, meteredTavilySearch, type MeteringContext } from "../llm-metering";
import { estimateInputTokenReservation } from "../../../helpers/phase2-budget.helper";
import { providerCallBudget } from "../budget-policy.service";

export const improverAgent = async (
  report: AnalyticsReport,
  model: string,
  context?: MeteringContext,
): Promise<ImproverOutput> => {
  const messages: MessageParam[] = [
    { role: "user", content: JSON.stringify(report) },
  ];

  try {
    for (let i = 0; i < FACT_CHECK_RUNS; i++) {
      const response = await meteredAnthropicCall(context, "improver", model, () => client.messages.parse({
        model,
        max_tokens: 8192,
        system: improverPrompt,
        tools: [tavliySearchTool],
        output_config: {
          format: zodOutputFormat(ImproverOutputSchema),
        },
        messages,
      }, { maxRetries: 0 }), providerCallBudget({
        inputTokens: estimateInputTokenReservation(improverPrompt, messages, tavliySearchTool),
        outputTokens: 8_192,
      }));

      messages.push({ role: "assistant", content: response.content });

      const toolUses = response.content.filter((b) => b.type === "tool_use");
      if (toolUses.length === 0) {
        if (!response.parsed_output) {
          throw new Error("Improver agent returned null output");
        }
        return response.parsed_output;
      }

      const toolResults = await Promise.all(
        toolUses.map(async (tool) => {
          if (tool.name !== "tavily_search") {
            throw new Error(`Unexpected tool call: ${tool.name}`);
          }
          const query = (tool.input as { query: string }).query;
          const results = await meteredTavilySearch(context, query, () => runTavilySearch(query));
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
