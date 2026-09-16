import type { Transaction } from "sequelize";
import type { BudgetAmounts, BudgetMetric } from "../helpers/phase2-budget.helper";
import { BUDGET_METRICS, assertValidBudgetAmounts, findExceededBudgetMetric } from "../helpers/phase2-budget.helper";
import sequelize from "../configs/db.config";
import PipelineBudgetCounter from "../models/pipeline-budget-counter.model";
import PipelineBudgetReservation from "../models/pipeline-budget-reservation.model";
import Reels from "../models/reels.model";

const counterFields: Record<BudgetMetric, { reserved: keyof PipelineBudgetCounter; consumed: keyof PipelineBudgetCounter }> = {
  providerCalls: { reserved: "reservedProviderCalls", consumed: "consumedProviderCalls" },
  inputTokens: { reserved: "reservedInputTokens", consumed: "consumedInputTokens" },
  outputTokens: { reserved: "reservedOutputTokens", consumed: "consumedOutputTokens" },
  searches: { reserved: "reservedSearches", consumed: "consumedSearches" },
  generatedVideoSeconds: { reserved: "reservedGeneratedSeconds", consumed: "consumedGeneratedSeconds" },
  aiRevisions: { reserved: "reservedAiRevisions", consumed: "consumedAiRevisions" },
};

const reservationFields: Record<BudgetMetric, { requested: keyof PipelineBudgetReservation; actual: keyof PipelineBudgetReservation }> = {
  providerCalls: { requested: "requestedProviderCalls", actual: "actualProviderCalls" },
  inputTokens: { requested: "requestedInputTokens", actual: "actualInputTokens" },
  outputTokens: { requested: "requestedOutputTokens", actual: "actualOutputTokens" },
  searches: { requested: "requestedSearches", actual: "actualSearches" },
  generatedVideoSeconds: { requested: "requestedGeneratedSeconds", actual: "actualGeneratedSeconds" },
  aiRevisions: { requested: "requestedAiRevisions", actual: "actualAiRevisions" },
};

function readNumber(record: object, field: string): number {
  const value = (record as unknown as Record<string, unknown>)[field];
  const parsed = Number(value);
  if (!Number.isFinite(parsed) || parsed < 0) throw new Error(`Invalid persisted budget value for ${field}`);
  return parsed;
}

function writeNumber(record: object, field: string, value: number): void {
  (record as unknown as Record<string, unknown>)[field] =
    field.includes("Tokens") || field.includes("GeneratedSeconds") ? String(value) : value;
}

function readCounter(counter: PipelineBudgetCounter, side: "reserved" | "consumed"): BudgetAmounts {
  return Object.fromEntries(BUDGET_METRICS.map((metric) => [metric, readNumber(counter, String(counterFields[metric][side]))])) as unknown as BudgetAmounts;
}

function readRequested(reservation: PipelineBudgetReservation): BudgetAmounts {
  return Object.fromEntries(BUDGET_METRICS.map((metric) => [metric, readNumber(reservation, String(reservationFields[metric].requested))])) as unknown as BudgetAmounts;
}

function readFinalized(reservation: PipelineBudgetReservation): BudgetAmounts {
  return Object.fromEntries(BUDGET_METRICS.map((metric) => [metric, readNumber(reservation, String(reservationFields[metric].actual))])) as unknown as BudgetAmounts;
}

function sameAmounts(left: BudgetAmounts, right: BudgetAmounts): boolean {
  return BUDGET_METRICS.every((metric) => left[metric] === right[metric]);
}

async function requireOwnedPipeline(pipelineId: string, userId: string, transaction: Transaction) {
  const pipeline = await Reels.findOne({
    where: { id: pipelineId, userId },
    transaction,
    lock: transaction.LOCK.UPDATE,
  });
  if (!pipeline) throw new Error("Reel not found");
}

async function lockedCounter(pipelineId: string, userId: string, transaction: Transaction) {
  await PipelineBudgetCounter.findOrCreate({
    where: { pipelineId },
    defaults: {
      pipelineId,
      userId,
      reservedProviderCalls: 0,
      consumedProviderCalls: 0,
      reservedInputTokens: "0",
      consumedInputTokens: "0",
      reservedOutputTokens: "0",
      consumedOutputTokens: "0",
      reservedSearches: 0,
      consumedSearches: 0,
      reservedGeneratedSeconds: "0",
      consumedGeneratedSeconds: "0",
      reservedAiRevisions: 0,
      consumedAiRevisions: 0,
    },
    transaction,
  });
  const counter = await PipelineBudgetCounter.findByPk(pipelineId, {
    transaction,
    lock: transaction.LOCK.UPDATE,
  });
  if (!counter || counter.userId !== userId) throw new Error("Pipeline budget counter ownership mismatch");
  return counter;
}

function reservationResult(reservation: PipelineBudgetReservation, requested: BudgetAmounts) {
  return {
    kind: "reserved" as const,
    reservation: {
      pipelineId: reservation.pipelineId,
      userId: reservation.userId,
      reservationKey: reservation.id,
      reserved: requested,
    },
  };
}

export type PipelineBudgetReservationResult =
  | {
      kind: "reserved";
      reservation: { pipelineId: string; userId: string; reservationKey: string; reserved: BudgetAmounts };
    }
  | { kind: "limit_exceeded"; metric: BudgetMetric; used: number; requested: number; limit: number };

export interface PipelineBudgetRepository {
  reserve(input: {
    pipelineId: string;
    userId: string;
    reservationKey: string;
    limits: BudgetAmounts;
    requested: BudgetAmounts;
  }): Promise<PipelineBudgetReservationResult>;
  finalize(input: {
    pipelineId: string;
    userId: string;
    reservationKey: string;
    finalized: BudgetAmounts;
  }): Promise<void>;
  release(input: { pipelineId: string; userId: string; reservationKey: string }): Promise<void>;
}

export const pipelineBudgetReservationRepository: PipelineBudgetRepository = {
  async reserve(input: {
    pipelineId: string;
    userId: string;
    reservationKey: string;
    limits: BudgetAmounts;
    requested: BudgetAmounts;
  }) {
    assertValidBudgetAmounts(input.limits, "limits");
    assertValidBudgetAmounts(input.requested, "requested");
    return sequelize.transaction(async (transaction) => {
      await requireOwnedPipeline(input.pipelineId, input.userId, transaction);
      const counter = await lockedCounter(input.pipelineId, input.userId, transaction);
      const existing = await PipelineBudgetReservation.findByPk(input.reservationKey, {
        transaction,
        lock: transaction.LOCK.UPDATE,
      });
      if (existing) {
        if (existing.pipelineId !== input.pipelineId || existing.userId !== input.userId) {
          throw new Error("Budget reservation key already belongs to another pipeline");
        }
        const requested = readRequested(existing);
        if (!sameAmounts(requested, input.requested)) {
          throw new Error("Budget reservation replay changed the requested amounts");
        }
        return reservationResult(existing, requested);
      }

      const reserved = readCounter(counter, "reserved");
      const consumed = readCounter(counter, "consumed");
      const used = Object.fromEntries(BUDGET_METRICS.map((metric) => [metric, reserved[metric] + consumed[metric]])) as unknown as BudgetAmounts;
      const exceeded = findExceededBudgetMetric(used, input.requested, input.limits);
      if (exceeded) {
        return {
          kind: "limit_exceeded" as const,
          metric: exceeded,
          used: used[exceeded],
          requested: input.requested[exceeded],
          limit: input.limits[exceeded],
        };
      }

      const values: Record<string, unknown> = {
        id: input.reservationKey,
        pipelineId: input.pipelineId,
        userId: input.userId,
        stageAttemptId: null,
        status: "reserved",
      };
      for (const metric of BUDGET_METRICS) {
        const field = String(reservationFields[metric].requested);
        values[field] = field.includes("Tokens") || field.includes("GeneratedSeconds")
          ? String(input.requested[metric])
          : input.requested[metric];
        writeNumber(counter, String(counterFields[metric].reserved), reserved[metric] + input.requested[metric]);
      }
      const reservation = await PipelineBudgetReservation.create(values as never, { transaction });
      await counter.save({ transaction });
      return reservationResult(reservation, input.requested);
    });
  },

  async finalize(input: {
    pipelineId: string;
    userId: string;
    reservationKey: string;
    finalized: BudgetAmounts;
  }): Promise<void> {
    assertValidBudgetAmounts(input.finalized, "finalized");
    await sequelize.transaction(async (transaction) => {
      await requireOwnedPipeline(input.pipelineId, input.userId, transaction);
      const counter = await lockedCounter(input.pipelineId, input.userId, transaction);
      const reservation = await PipelineBudgetReservation.findByPk(input.reservationKey, {
        transaction,
        lock: transaction.LOCK.UPDATE,
      });
      if (!reservation || reservation.pipelineId !== input.pipelineId || reservation.userId !== input.userId) {
        throw new Error("Budget reservation not found");
      }
      if (reservation.status === "released") throw new Error("Released budget reservation cannot be finalized");
      if (reservation.status === "settled") {
        if (!sameAmounts(readFinalized(reservation), input.finalized)) {
          throw new Error("Budget reservation replay changed finalized amounts");
        }
        return;
      }

      const requested = readRequested(reservation);
      const reserved = readCounter(counter, "reserved");
      const consumed = readCounter(counter, "consumed");
      for (const metric of BUDGET_METRICS) {
        writeNumber(counter, String(counterFields[metric].reserved), reserved[metric] - requested[metric]);
        writeNumber(counter, String(counterFields[metric].consumed), consumed[metric] + input.finalized[metric]);
        writeNumber(reservation, String(reservationFields[metric].actual), input.finalized[metric]);
      }
      reservation.status = "settled";
      reservation.settledAt = new Date();
      await reservation.save({ transaction });
      await counter.save({ transaction });
    });
  },

  async release(input: {
    pipelineId: string;
    userId: string;
    reservationKey: string;
  }): Promise<void> {
    await sequelize.transaction(async (transaction) => {
      await requireOwnedPipeline(input.pipelineId, input.userId, transaction);
      const counter = await lockedCounter(input.pipelineId, input.userId, transaction);
      const reservation = await PipelineBudgetReservation.findByPk(input.reservationKey, {
        transaction,
        lock: transaction.LOCK.UPDATE,
      });
      if (!reservation || reservation.pipelineId !== input.pipelineId || reservation.userId !== input.userId) {
        throw new Error("Budget reservation not found");
      }
      if (reservation.status === "released") return;
      if (reservation.status === "settled") throw new Error("Settled budget reservation cannot be released");

      const requested = readRequested(reservation);
      const reserved = readCounter(counter, "reserved");
      for (const metric of BUDGET_METRICS) {
        writeNumber(counter, String(counterFields[metric].reserved), reserved[metric] - requested[metric]);
      }
      reservation.status = "released";
      reservation.releasedAt = new Date();
      await reservation.save({ transaction });
      await counter.save({ transaction });
    });
  },
};

export async function getPipelineBudgetSnapshot(pipelineId: string, userId: string) {
  const pipeline = await Reels.findOne({ where: { id: pipelineId, userId } });
  if (!pipeline) throw new Error("Reel not found");
  const counter = await PipelineBudgetCounter.findByPk(pipelineId);
  if (!counter) {
    const zero = Object.fromEntries(BUDGET_METRICS.map((metric) => [metric, 0])) as unknown as BudgetAmounts;
    return { reserved: zero, consumed: zero };
  }
  return { reserved: readCounter(counter, "reserved"), consumed: readCounter(counter, "consumed") };
}
