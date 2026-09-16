import type {
  ActualBudgetAmounts,
  BudgetAmounts,
} from "../../helpers/phase2-budget.helper";
import { pipelineBudgetReservationRepository } from "../../repositories/pipeline-budget.repository";
import {
  finalizeProviderCallBudget,
  releaseProviderCallBudgetBeforeStart,
  reserveProviderCallBudget,
  type BudgetReservation,
} from "./budget-policy.service";
import type { ResolvedGenerationEntitlement } from "./entitlement-resolution.service";

export interface ProviderBudgetContext {
  reserve(
    reservationKey: string,
    attemptNumber: number,
    requested: BudgetAmounts,
  ): Promise<BudgetReservation>;
  finalize(
    reservation: BudgetReservation,
    actual: ActualBudgetAmounts,
  ): Promise<void>;
  releaseBeforeStart(reservation: BudgetReservation): Promise<void>;
}

export function createProviderBudgetContext(
  pipelineId: string,
  access: ResolvedGenerationEntitlement,
): ProviderBudgetContext {
  return {
    reserve: (reservationKey, attemptNumber, requested) =>
      reserveProviderCallBudget(pipelineBudgetReservationRepository, access, {
        pipelineId,
        reservationKey,
        attemptNumber,
        requested,
      }),
    finalize: (reservation, actual) =>
      finalizeProviderCallBudget(
        pipelineBudgetReservationRepository,
        reservation,
        actual,
      ),
    releaseBeforeStart: (reservation) =>
      releaseProviderCallBudgetBeforeStart(
        pipelineBudgetReservationRepository,
        reservation,
      ),
  };
}
