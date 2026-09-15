export const BUDGET_METRICS = [
  "providerCalls",
  "inputTokens",
  "outputTokens",
  "searches",
  "generatedVideoSeconds",
  "aiRevisions",
] as const;

export type BudgetMetric = (typeof BUDGET_METRICS)[number];
export type BudgetAmounts = Readonly<Record<BudgetMetric, number>>;
export type ActualBudgetAmounts = Readonly<
  Partial<Record<BudgetMetric, number | null>>
>;

const integerMetrics = new Set<BudgetMetric>([
  "providerCalls",
  "inputTokens",
  "outputTokens",
  "searches",
  "aiRevisions",
]);

export const ZERO_BUDGET_AMOUNTS: BudgetAmounts = {
  providerCalls: 0,
  inputTokens: 0,
  outputTokens: 0,
  searches: 0,
  generatedVideoSeconds: 0,
  aiRevisions: 0,
};

/** Conservative pre-call estimate: UTF-8 bytes bound tokenizer pieces, plus protocol overhead. */
export function estimateInputTokenReservation(...values: unknown[]): number {
  const serialized = values.map((value) =>
    typeof value === "string" ? value : JSON.stringify(value),
  ).join("\n");
  return Buffer.byteLength(serialized, "utf8") + 2_048;
}

export function assertValidBudgetAmounts(
  amounts: BudgetAmounts,
  label: string,
): void {
  for (const metric of BUDGET_METRICS) {
    const value = amounts[metric];
    if (!Number.isFinite(value) || value < 0) {
      throw new Error(`${label}.${metric} must be a non-negative finite number`);
    }
    if (integerMetrics.has(metric) && !Number.isInteger(value)) {
      throw new Error(`${label}.${metric} must be an integer`);
    }
  }
}

export function findExceededBudgetMetric(
  used: BudgetAmounts,
  requested: BudgetAmounts,
  limits: BudgetAmounts,
): BudgetMetric | null {
  assertValidBudgetAmounts(used, "used");
  assertValidBudgetAmounts(requested, "requested");
  assertValidBudgetAmounts(limits, "limits");

  return BUDGET_METRICS.find(
    (metric) => used[metric] + requested[metric] > limits[metric],
  ) ?? null;
}

/**
 * Unknown actual use retains the entire reservation. This deliberately treats
 * missing provider usage as unavailable capacity rather than as free usage.
 */
export function resolveFinalBudgetAmounts(
  reserved: BudgetAmounts,
  actual: ActualBudgetAmounts,
): BudgetAmounts {
  assertValidBudgetAmounts(reserved, "reserved");
  const finalized = { ...reserved };

  for (const metric of BUDGET_METRICS) {
    const value = actual[metric];
    if (value === undefined || value === null) continue;
    const candidate = { ...ZERO_BUDGET_AMOUNTS, [metric]: value };
    assertValidBudgetAmounts(candidate, "actual");
    finalized[metric] = value;
  }

  return finalized;
}
