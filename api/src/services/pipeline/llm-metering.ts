import { randomUUID } from "node:crypto";
import { LLM_PRICING } from "../../constants/constant";
import { calculateLlmCost } from "../../utils/cost.util";
import {
  extractLlmUsage,
  type AnthropicUsageResponse,
} from "../../helpers/usage.helper";
import {
  beginProviderAttempt,
  finishProviderAttempt,
} from "../../repositories/provider-usage.repository";
import type { BudgetAmounts } from "../../helpers/phase2-budget.helper";
import type { ProviderBudgetContext } from "./provider-budget.service";
import { providerCallBudget } from "./budget-policy.service";
import type { WorkflowStageLease } from "./workflow-dispatcher.service";

export interface MeteringContext {
  userId: string;
  pipelineId: string;
  stage: string;
  budget?: ProviderBudgetContext;
  lease?: WorkflowStageLease;
}

const errorMessage = (error: unknown): string =>
  error instanceof Error ? error.message : String(error);

const retryable = (error: unknown): boolean => {
  if (!error || typeof error !== "object") return false;
  const status = "status" in error ? error.status : undefined;
  if (typeof status === "number") {
    return status === 408 || status === 409 || status === 429 || status >= 500;
  }
  const name = "name" in error ? error.name : undefined;
  return name === "APIConnectionError" || name === "APIConnectionTimeoutError";
};

const pause = (milliseconds: number): Promise<void> =>
  new Promise((resolve) => setTimeout(resolve, milliseconds));

/** SDK retries must be disabled by callers so that every network attempt is visible here. */
export async function meteredAnthropicCall<T extends AnthropicUsageResponse>(
  context: MeteringContext | undefined,
  operation: string,
  model: string,
  invoke: () => Promise<T>,
  requestedBudget?: BudgetAmounts,
): Promise<T> {
  let previousAttemptId: string | undefined;

  // Match the SDK's default of two retries, with each attempt represented in the ledger.
  for (let attempt = 0; attempt < 3; attempt++) {
    const attemptId = randomUUID();
    const budgetReservation = inputBudget(context, requestedBudget)
      ? await context!.budget!.reserve(attemptId, attempt + 1, requestedBudget!)
      : undefined;
    if (context) {
      try {
        await beginProviderAttempt({
          attemptId,
          userId: context.userId,
          pipelineId: context.pipelineId,
          operation,
          stage: context.stage,
          provider: "aws-bedrock",
          model,
          configuration: { api: "anthropic.messages.parse", attempt: attempt + 1 },
          ...(previousAttemptId ? { retryOfAttemptId: previousAttemptId } : {}),
        });
      } catch (error) {
        if (budgetReservation) await context.budget!.releaseBeforeStart(budgetReservation);
        throw error;
      }
    }

    let response: T;
    try {
      response = await invoke();
    } catch (error) {
      const willRetry = attempt < 2 && retryable(error);
      if (context) {
        await finishProviderAttempt({
          attemptId,
          status: willRetry ? "retried" : "failed",
          costUsd: null,
          costProvenance: "unknown",
          error: errorMessage(error),
        });
      }
      if (budgetReservation) {
        await context!.budget!.finalize(budgetReservation, {
          providerCalls: 1,
          inputTokens: null,
          outputTokens: null,
        });
      }
      if (!willRetry) throw error;
      previousAttemptId = attemptId;
      await pause(500 * 2 ** attempt);
      continue;
    }

    if (context) {
      const usage = extractLlmUsage(response);
      const hasRate = Object.hasOwn(LLM_PRICING, model);
      await finishProviderAttempt({
        attemptId,
        status: "succeeded",
        usage,
        costUsd: hasRate
          ? calculateLlmCost(usage, model as keyof typeof LLM_PRICING).toString()
          : null,
        costProvenance: hasRate ? "estimated" : "unknown",
        rateVersion: hasRate ? "llm-pricing-2026-09-14" : null,
      });
      if (budgetReservation) {
        await context.budget!.finalize(budgetReservation, {
          providerCalls: 1,
          inputTokens: usage.inputTokens,
          outputTokens: usage.outputTokens,
        });
      }
    }
    return response;
  }
  throw new Error("Anthropic retry loop exhausted");
}

function inputBudget(
  context: MeteringContext | undefined,
  requested: BudgetAmounts | undefined,
): boolean {
  return Boolean(context?.budget && requested);
}

export async function meteredTavilySearch<T>(
  context: MeteringContext | undefined,
  query: string,
  search: () => Promise<T>,
): Promise<T> {
  if (!context) return search();
  const attemptId = randomUUID();
  const requested = context.budget
    ? providerCallBudget({ searches: 1 })
    : undefined;
  const budgetReservation = requested
    ? await context.budget!.reserve(attemptId, 1, requested)
    : undefined;
  try {
    await beginProviderAttempt({
    attemptId,
    userId: context.userId,
    pipelineId: context.pipelineId,
    operation: "tavily-search",
    stage: context.stage,
    provider: "tavily",
    model: null,
    configuration: { searchDepth: "basic", maxResults: 5, query },
    });
  } catch (error) {
    if (budgetReservation) await context.budget!.releaseBeforeStart(budgetReservation);
    throw error;
  }
  let result: T;
  try {
    result = await search();
  } catch (error) {
    await finishProviderAttempt({
      attemptId,
      status: "failed",
      costUsd: null,
      costProvenance: "unknown",
      error: errorMessage(error),
    });
    if (budgetReservation) {
      await context.budget!.finalize(budgetReservation, {
        providerCalls: 1,
        searches: 1,
      });
    }
    throw error;
  }
  await finishProviderAttempt({
    attemptId,
    status: "succeeded",
    costUsd: null,
    costProvenance: "unknown",
  });
  if (budgetReservation) {
    await context.budget!.finalize(budgetReservation, {
      providerCalls: 1,
      searches: 1,
    });
  }
  return result;
}
