import type { MessageParam } from "@anthropic-ai/sdk/resources";
import client from "../../../configs/llm.config";
import { ScriptOutput } from "../../../schema/script-writer.schema";
import { FACT_CHECK_RUNS } from "../../../constants/constant";
import { zodOutputFormat } from "@anthropic-ai/sdk/helpers/zod";
import { tavliySearchTool } from "../../../tools/tavily-search.tool";
import { FactCheckOutputSchema, type FactCheckOutput } from "../../../schema/fact-checker.schema";
import { runTavilySearch } from "../../../configs/tavily.config";
import { factCheckerPrompt } from "../../../llm/fact-checker.prompt";
import { accumulateLlmUsage } from "../../../utils/cost.util";
import type { AgentResult, LlmUsage } from "../../../types/usage.types";
import { meteredAnthropicCall, meteredTavilySearch, type MeteringContext } from "../llm-metering";
import { extractLlmUsage } from "../../../helpers/usage.helper";

export const factCheckerAgent = async (
  script: ScriptOutput,
  model: string,
  context?: MeteringContext,
): Promise<AgentResult<FactCheckOutput | null>> => {
  const today = new Date().toISOString().split("T")[0] ?? "";
  const messages: MessageParam[] = [
    {
      role: "user",
      content: `Review this script.\n${JSON.stringify(script)}`,
    },
  ];
  const usages: LlmUsage[] = [];

  for (let i = 0; i < FACT_CHECK_RUNS; i++) {
    const response = await meteredAnthropicCall(context, "fact-checker", model, () => client.messages.parse({
      model,
      max_tokens: 8192,
      system: factCheckerPrompt(today),
      tools: [tavliySearchTool],
      output_config: {
        format: zodOutputFormat(FactCheckOutputSchema),
      },
      messages,
    }, { maxRetries: 0 }));

    usages.push(extractLlmUsage(response));

    messages.push({ role: "assistant", content: response.content });
    const toolUses = response.content.filter((b) => b.type === "tool_use");
    if (toolUses.length === 0) {
      return { data: response.parsed_output, usage: accumulateLlmUsage(usages) };
    }
    const toolCallResults = await Promise.all(
      toolUses.map(async (tool) => {
        if (tool.name !== "tavily_search") {
          throw new Error(`Unexpected tool call : ${tool.name}`);
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
    messages.push({
      role: "user",
      content: toolCallResults,
    });
  }
  throw new Error(`Fact checker didnt finish within ${FACT_CHECK_RUNS} runs`);
};
