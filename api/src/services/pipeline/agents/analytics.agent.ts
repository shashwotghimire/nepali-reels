import { zodOutputFormat } from "@anthropic-ai/sdk/helpers/zod";
import client from "../../../configs/llm.config";
import { analyticsPrompt } from "../../../llm/analytics.prompt";
import { AnalyticsReportSchema, type AnalyticsReport } from "../../../schema/analytics.schema";
import type { TikTokVideoInsight } from "../../../models/analytics.model";
import { meteredAnthropicCall, type MeteringContext } from "../llm-metering";
import { estimateInputTokenReservation } from "../../../helpers/phase2-budget.helper";
import { providerCallBudget } from "../budget-policy.service";

export const analyticsAgent = async (
  rawData: TikTokVideoInsight[],
  model: string,
  context?: MeteringContext,
): Promise<AnalyticsReport> => {
  try {
    const response = await meteredAnthropicCall(context, "analytics", model, () => client.messages.parse({
      model,
      max_tokens: 8192,
      system: analyticsPrompt,
      output_config: {
        format: zodOutputFormat(AnalyticsReportSchema),
      },
      messages: [
        {
          role: "user",
          content: JSON.stringify(rawData),
        },
      ],
    }, { maxRetries: 0 }), providerCallBudget({
      inputTokens: estimateInputTokenReservation(analyticsPrompt, rawData),
      outputTokens: 8_192,
    }));

    if (!response.parsed_output) {
      throw new Error("Analytics agent returned null output");
    }

    return response.parsed_output;
  } catch (error) {
    throw new Error(
      `analyticsAgent failed: ${error instanceof Error ? error.message : String(error)}`,
    );
  }
};
