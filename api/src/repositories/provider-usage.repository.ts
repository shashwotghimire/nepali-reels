import ProviderUsage, {
  type CostProvenance,
  type ProviderAttemptStatus,
  type ProviderUsageMetrics,
} from "../models/provider-usage.model";

export interface BeginProviderAttempt {
  /** A fresh UUID for this physical provider invocation, including each retry. */
  attemptId: string;
  userId: string;
  pipelineId: string;
  operation: string;
  stage: string;
  provider: string;
  model: string | null;
  configuration?: object | null;
  retryOfAttemptId?: string | null;
}

export interface FinishProviderAttempt {
  attemptId: string;
  status: Exclude<ProviderAttemptStatus, "pending">;
  usage?: Partial<ProviderUsageMetrics>;
  costUsd: string | number | null;
  costProvenance: CostProvenance;
  rateVersion?: string | null;
  error?: string | null;
}

const metricNames = [
  "inputTokens",
  "outputTokens",
  "cacheWriteTokens",
  "cacheReadTokens",
  "audioInputSeconds",
  "audioOutputSeconds",
  "audioCharacters",
  "generatedVideoSeconds",
  "imageCount",
  "imageUsage",
] as const;

/** Insert once before the call. Replays preserve an already completed attempt. */
export async function beginProviderAttempt(input: BeginProviderAttempt) {
  const [attempt] = await ProviderUsage.findOrCreate({
    where: { attemptId: input.attemptId },
    defaults: {
      attemptId: input.attemptId,
      userId: input.userId,
      pipelineId: input.pipelineId,
      retryOfAttemptId: input.retryOfAttemptId ?? null,
      operation: input.operation,
      stage: input.stage,
      provider: input.provider,
      model: input.model,
      configuration: input.configuration ?? null,
      status: "pending",
      costUsd: null,
      currency: "USD",
      costProvenance: "unknown",
    },
  });

  // A reused attempt ID must never silently attribute one invocation to another.
  if (
    attempt.userId !== input.userId ||
    attempt.pipelineId !== input.pipelineId ||
    attempt.operation !== input.operation ||
    attempt.stage !== input.stage ||
    attempt.provider !== input.provider ||
    attempt.model !== input.model ||
    attempt.retryOfAttemptId !== (input.retryOfAttemptId ?? null)
  ) {
    throw new Error(`Provider attempt ID ${input.attemptId} already belongs to another call`);
  }
  return attempt;
}

/** Complete an existing attempt; writing the same result twice does not add cost. */
export async function finishProviderAttempt(input: FinishProviderAttempt) {
  const knownCost = input.costProvenance !== "unknown";
  if (knownCost !== (input.costUsd !== null)) {
    throw new Error("Known provider cost requires an amount; unknown cost must be null");
  }
  if (input.costUsd !== null && (!Number.isFinite(Number(input.costUsd)) || Number(input.costUsd) < 0)) {
    throw new Error("Provider cost must be a non-negative finite USD amount");
  }
  if (input.costProvenance === "estimated" && !input.rateVersion) {
    throw new Error("Estimated provider cost requires a rate version");
  }

  const values: Partial<ProviderUsage> = {
    status: input.status,
    costUsd: input.costUsd === null ? null : String(input.costUsd),
    costProvenance: input.costProvenance,
    rateVersion: input.rateVersion ?? null,
    errorMessage: input.error ?? null,
  };
  for (const name of metricNames) {
    const value = input.usage?.[name];
    if (value !== undefined) {
      // DECIMAL values are stored as strings to avoid binary-float serialization.
      (values as Record<string, unknown>)[name] =
        (name === "audioInputSeconds" ||
          name === "audioOutputSeconds" ||
          name === "generatedVideoSeconds") && value !== null
          ? String(value)
          : value;
    }
  }

  const [updated] = await ProviderUsage.update(values, {
    where: { attemptId: input.attemptId },
  });
  if (updated === 0) {
    throw new Error(`Provider attempt ${input.attemptId} was not begun`);
  }
}

export async function getPipelineCostSummary(
  pipelineId: string,
  userId: string,
): Promise<{ knownCostUsd: number; hasUnknownCost: boolean }> {
  const attempts = await ProviderUsage.findAll({
    where: { pipelineId, userId },
    attributes: ["costUsd", "costProvenance", "status"],
  });
  let knownCostUnits = 0n;
  let hasUnknownCost = false;
  for (const attempt of attempts) {
    if (attempt.status === "pending" || attempt.costUsd === null) {
      hasUnknownCost = true;
    } else {
      // Include billed failures and retries: each row is one physical call.
      const [whole, fraction = ""] = attempt.costUsd.split(".");
      knownCostUnits += BigInt(whole!) * 100_000_000n + BigInt(fraction.padEnd(8, "0"));
    }
  }
  return { knownCostUsd: Number(knownCostUnits) / 100_000_000, hasUnknownCost };
}
