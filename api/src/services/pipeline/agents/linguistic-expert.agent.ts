import type { MessageParam } from "@anthropic-ai/sdk/resources";
import client from "../../../configs/llm.config";
import { ScriptOutput } from "../../../schema/script-writer.schema";
import { zodOutputFormat } from "@anthropic-ai/sdk/helpers/zod";
import { LinguisticExpertOutputSchema, type LinguisticExpertOutput } from "../../../schema/linguistic-expert.schema";
import { linguisticExpertPrompt } from "../../../llm/linguistic-expert.prompt";
import { tavliySearchTool } from "../../../tools/tavily-search.tool";
import { runTavilySearch } from "../../../configs/tavily.config";
import { FACT_CHECK_RUNS } from "../../../constants/constant";
import { accumulateLlmUsage } from "../../../utils/cost.util";
import type { AgentResult, LlmUsage } from "../../../types/usage.types";
import { meteredAnthropicCall, meteredTavilySearch, type MeteringContext } from "../llm-metering";
import { extractLlmUsage } from "../../../helpers/usage.helper";
import { estimateInputTokenReservation } from "../../../helpers/phase2-budget.helper";
import { providerCallBudget } from "../budget-policy.service";

export const linguisticExpertAgent = async (
  script: ScriptOutput,
  model: string,
  context?: MeteringContext,
): Promise<AgentResult<LinguisticExpertOutput | null>> => {
  const messages: MessageParam[] = [
    {
      role: "user",
      content: `Review this script for natural spoken Nepali.\n${JSON.stringify(script)}`,
    },
  ];
  const usages: LlmUsage[] = [];

  for (let i = 0; i < FACT_CHECK_RUNS; i++) {
    const response = await meteredAnthropicCall(context, "linguistic-expert", model, () => client.messages.parse({
      model,
      max_tokens: 8192,
      system: linguisticExpertPrompt,
      tools: [tavliySearchTool],
      output_config: {
        format: zodOutputFormat(LinguisticExpertOutputSchema),
      },
      messages,
    }, { maxRetries: 0 }), providerCallBudget({
      inputTokens: estimateInputTokenReservation(linguisticExpertPrompt, messages, tavliySearchTool),
      outputTokens: 8_192,
    }));

    usages.push(extractLlmUsage(response));

    messages.push({ role: "assistant", content: response.content });
    const toolUses = response.content.filter((b) => b.type === "tool_use");
    if (toolUses.length === 0) {
      return { data: response.parsed_output, usage: accumulateLlmUsage(usages) };
    }
    const toolCallResults = await Promise.all(
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
    messages.push({ role: "user", content: toolCallResults });
  }
  throw new Error(`Linguistic expert agent didn't finish within ${FACT_CHECK_RUNS} runs`);
};
