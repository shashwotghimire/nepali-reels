import type {
  ActualBudgetAmounts,
  BudgetAmounts,
  BudgetMetric,
} from "../../helpers/phase2-budget.helper";
import {
  ZERO_BUDGET_AMOUNTS,
  assertValidBudgetAmounts,
  resolveFinalBudgetAmounts,
} from "../../helpers/phase2-budget.helper";
import type { ResolvedGenerationEntitlement } from "./entitlement-resolution.service";
import { COST_BUDGET_POLICY } from "../../commercial/policy";

export const MAX_PROVIDER_ATTEMPTS_PER_CALL = 3;

/**
 * Initial aggregate operational ceilings. They cap measurable resources, not
 * USD spend: unknown provider prices and missing usage remain unknown.
 */
export function getGenerationBudgetLimits(
  access: ResolvedGenerationEntitlement,
): BudgetAmounts {
  return {
    providerCalls: COST_BUDGET_POLICY.aggregatePlanningCeilings.providerCalls,
    inputTokens: COST_BUDGET_POLICY.aggregatePlanningCeilings.llmInputTokens,
    outputTokens: COST_BUDGET_POLICY.aggregatePlanningCeilings.llmOutputTokens,
    searches: COST_BUDGET_POLICY.aggregatePlanningCeilings.researchSearches,
    generatedVideoSeconds:
      access.entitlement.id === "trial"
        ? 36
        : COST_BUDGET_POLICY.aggregatePlanningCeilings.generatedVideoSeconds,
    aiRevisions: access.entitlement.aiRevisionsPerVideo,
  };
}

export interface BudgetReservation {
  pipelineId: string;
  userId: string;
  reservationKey: string;
  reserved: BudgetAmounts;
}

export type BudgetReservationResult =
  | { kind: "reserved"; reservation: BudgetReservation }
  | {
      kind: "limit_exceeded";
      metric: BudgetMetric;
      used: number;
      requested: number;
      limit: number;
    };

export interface BudgetReservationRepository {
  /** Must atomically include settled usage and every in-flight reservation. */
  reserve(input: {
    pipelineId: string;
    userId: string;
    reservationKey: string;
    limits: BudgetAmounts;
    requested: BudgetAmounts;
  }): Promise<BudgetReservationResult>;

  /** Replaces the in-flight reservation with final accounted resource use. */
  finalize(input: {
    pipelineId: string;
    userId: string;
    reservationKey: string;
    finalized: BudgetAmounts;
  }): Promise<void>;

  /** Only valid when the provider call is confirmed not to have started. */
  release(input: {
    pipelineId: string;
    userId: string;
    reservationKey: string;
  }): Promise<void>;
}

export class GenerationBudgetExceededError extends Error {
  constructor(readonly result: Extract<BudgetReservationResult, { kind: "limit_exceeded" }>) {
    super(
      `Generation budget exceeded for ${result.metric}: ${result.used} + ${result.requested} > ${result.limit}`,
    );
    this.name = "GenerationBudgetExceededError";
  }
}

export interface ReserveProviderCallInput {
  pipelineId: string;
  reservationKey: string;
  attemptNumber: number;
  /** Worst-case measurable use reserved before invoking the provider. */
  requested: BudgetAmounts;
}

export async function reserveProviderCallBudget(
  repository: BudgetReservationRepository,
  access: ResolvedGenerationEntitlement,
  input: ReserveProviderCallInput,
): Promise<BudgetReservation> {
  if (
    !Number.isInteger(input.attemptNumber) ||
    input.attemptNumber < 1 ||
    input.attemptNumber > MAX_PROVIDER_ATTEMPTS_PER_CALL
  ) {
    throw new Error(
      `Provider attempt number must be between 1 and ${MAX_PROVIDER_ATTEMPTS_PER_CALL}`,
    );
  }
  assertValidBudgetAmounts(input.requested, "requested");
  if (input.requested.providerCalls < 1) {
    throw new Error("A provider-call reservation must reserve at least one provider call");
  }

  const result = await repository.reserve({
    pipelineId: input.pipelineId,
    userId: access.userId,
    reservationKey: input.reservationKey,
    limits: getGenerationBudgetLimits(access),
    requested: input.requested,
  });
  if (result.kind === "limit_exceeded") {
    throw new GenerationBudgetExceededError(result);
  }
  return result.reservation;
}

/**
 * Finalizes incurred usage. Missing provider metrics retain the full reservation
 * instead of reopening capacity as though the provider reported a measured zero.
 */
export async function finalizeProviderCallBudget(
  repository: BudgetReservationRepository,
  reservation: BudgetReservation,
  actual: ActualBudgetAmounts,
): Promise<void> {
  await repository.finalize({
    pipelineId: reservation.pipelineId,
    userId: reservation.userId,
    reservationKey: reservation.reservationKey,
    finalized: resolveFinalBudgetAmounts(reservation.reserved, actual),
  });
}

/** Releases capacity only when orchestration knows the provider was never invoked. */
export async function releaseProviderCallBudgetBeforeStart(
  repository: BudgetReservationRepository,
  reservation: BudgetReservation,
): Promise<void> {
  await repository.release({
    pipelineId: reservation.pipelineId,
    userId: reservation.userId,
    reservationKey: reservation.reservationKey,
  });
}

export function providerCallBudget(
  amounts: Partial<BudgetAmounts> = {},
): BudgetAmounts {
  return { ...ZERO_BUDGET_AMOUNTS, providerCalls: 1, ...amounts };
}
