import type { MessageParam } from "@anthropic-ai/sdk/resources";
import { zodOutputFormat } from "@anthropic-ai/sdk/helpers/zod";
import client from "../../../configs/llm.config";
import { runTavilySearch } from "../../../configs/tavily.config";
import { FACT_CHECK_RUNS } from "../../../constants/constant";
import { estimateInputTokenReservation } from "../../../helpers/phase2-budget.helper";
import {
  validateStoryScript,
  validateStoryVideoSpec,
} from "../../../helpers/phase3-content-validation.helper";
import { extractLlmUsage } from "../../../helpers/usage.helper";
import {
  storyReviewPrompt,
  storyScriptWriterPrompt,
  storyVideoSpecPrompt,
  type Phase3PromptDuration,
} from "../../../llm/story.prompt";
import {
  StoryReviewOutputSchema,
  StoryScriptOutputSchema,
  StoryVideoSpecSchema,
  type StoryInput,
  type StoryReviewOutput,
  type StoryScriptOutput,
  type StoryVideoSpec,
} from "../../../schema/story.schema";
import { tavliySearchTool } from "../../../tools/tavily-search.tool";
import type { AgentResult, LlmUsage } from "../../../types/usage.types";
import { accumulateLlmUsage } from "../../../utils/cost.util";
import { providerCallBudget } from "../budget-policy.service";
import {
  meteredAnthropicCall,
  meteredTavilySearch,
  type MeteringContext,
} from "../llm-metering";

const DEFAULT_DURATION: Phase3PromptDuration = {
  targetDurationSeconds: 60,
  maximumDurationSeconds: 70,
};

const today = (): string => new Date().toISOString().split("T")[0] ?? "";

async function continueWithSearch(
  messages: MessageParam[],
  responseContent: MessageParam["content"],
  context: MeteringContext | undefined,
): Promise<boolean> {
  if (!Array.isArray(responseContent)) return false;
  const toolUses = responseContent.filter((block) => block.type === "tool_use");
  if (toolUses.length === 0) return false;
  const results = await Promise.all(toolUses.map(async (tool) => {
    if (tool.name !== "tavily_search") throw new Error(`Unexpected tool call: ${tool.name}`);
    const query = (tool.input as { query: string }).query;
    return {
      type: "tool_result" as const,
      tool_use_id: tool.id,
      content: JSON.stringify(await meteredTavilySearch(context, query, () => runTavilySearch(query))),
    };
  }));
  messages.push({ role: "assistant", content: responseContent });
  messages.push({ role: "user", content: results });
  return true;
}

export const storyScriptGeneratorAgent = async (
  topic: string,
  input: StoryInput,
  model: string,
  context?: MeteringContext,
  duration: Phase3PromptDuration = DEFAULT_DURATION,
): Promise<AgentResult<StoryScriptOutput>> => {
  const prompt = storyScriptWriterPrompt(today(), input, duration);
  const messages: MessageParam[] = [{ role: "user", content: `Topic:\n${topic}` }];
  const usages: LlmUsage[] = [];
  const tools = input.treatment === "factual" ? [tavliySearchTool] : [];

  for (let run = 0; run < FACT_CHECK_RUNS; run++) {
    const response = await meteredAnthropicCall(context, "story-script-writer", model, () => client.messages.parse({
      model,
      max_tokens: 8192,
      system: prompt,
      tools,
      output_config: { format: zodOutputFormat(StoryScriptOutputSchema) },
      messages,
    }, { maxRetries: 0 }), providerCallBudget({
      inputTokens: estimateInputTokenReservation(prompt, messages, ...tools),
      outputTokens: 8_192,
    }));
    usages.push(extractLlmUsage(response));
    if (await continueWithSearch(messages, response.content, context)) continue;
    if (!response.parsed_output) throw new Error("Story script writer returned null output");
    validateStoryScript(input, response.parsed_output, duration.maximumDurationSeconds);
    return { data: response.parsed_output, usage: accumulateLlmUsage(usages) };
  }
  throw new Error(`Story script writer did not finish within ${FACT_CHECK_RUNS} runs`);
};

export const storyReviewAgent = async (
  input: StoryInput,
  script: StoryScriptOutput,
  model: string,
  context?: MeteringContext,
): Promise<AgentResult<StoryReviewOutput>> => {
  const prompt = storyReviewPrompt(today(), input.treatment);
  const messages: MessageParam[] = [{ role: "user", content: `Review this story:\n${JSON.stringify(script)}` }];
  const usages: LlmUsage[] = [];
  const tools = input.treatment === "factual" ? [tavliySearchTool] : [];

  for (let run = 0; run < FACT_CHECK_RUNS; run++) {
    const response = await meteredAnthropicCall(context, "story-reviewer", model, () => client.messages.parse({
      model,
      max_tokens: 8192,
      system: prompt,
      tools,
      output_config: { format: zodOutputFormat(StoryReviewOutputSchema) },
      messages,
    }, { maxRetries: 0 }), providerCallBudget({
      inputTokens: estimateInputTokenReservation(prompt, messages, ...tools),
      outputTokens: 8_192,
    }));
    usages.push(extractLlmUsage(response));
    if (await continueWithSearch(messages, response.content, context)) continue;
    const output = response.parsed_output;
    if (!output) throw new Error("Story reviewer returned null output");
    if ((output.verdict === "revise") !== (output.revisedScript !== null)) throw new Error("Story reviewer returned an inconsistent revision verdict");
    if (output.revisedScript) validateStoryScript(input, output.revisedScript);
    return { data: output, usage: accumulateLlmUsage(usages) };
  }
  throw new Error(`Story reviewer did not finish within ${FACT_CHECK_RUNS} runs`);
};

export const storyVideoSpecGeneratorAgent = async (
  input: StoryInput,
  script: StoryScriptOutput,
  model: string,
  context?: MeteringContext,
  duration: Phase3PromptDuration = DEFAULT_DURATION,
): Promise<AgentResult<StoryVideoSpec>> => {
  const prompt = storyVideoSpecPrompt(today(), input, duration);
  const response = await meteredAnthropicCall(context, "story-video-spec-generator", model, () => client.messages.parse({
    model,
    max_tokens: 8192,
    system: prompt,
    output_config: { format: zodOutputFormat(StoryVideoSpecSchema) },
    messages: [{ role: "user", content: `Approved story:\n${JSON.stringify(script)}` }],
  }, { maxRetries: 0 }), providerCallBudget({
    inputTokens: estimateInputTokenReservation(prompt, script),
    outputTokens: 8_192,
  }));
  if (!response.parsed_output) throw new Error("Story video spec generator returned null output");
  validateStoryVideoSpec(input, response.parsed_output, duration.maximumDurationSeconds);
  return { data: response.parsed_output, usage: extractLlmUsage(response) };
};

