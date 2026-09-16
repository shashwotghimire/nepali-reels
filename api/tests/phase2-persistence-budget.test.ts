import assert from "node:assert/strict";
import test from "node:test";
import type { BudgetAmounts } from "../src/helpers/phase2-budget.helper";
import sequelize from "../src/configs/db.config";
import PipelineBudgetCounter from "../src/models/pipeline-budget-counter.model";
import PipelineBudgetReservation from "../src/models/pipeline-budget-reservation.model";
import Reels from "../src/models/reels.model";
import { pipelineBudgetReservationRepository } from "../src/repositories/pipeline-budget.repository";

const pipelineId = "22222222-2222-4222-8222-222222222222";
const userId = "user-1";

function amounts(providerCalls: number): BudgetAmounts {
  return {
    providerCalls,
    inputTokens: 10,
    outputTokens: 5,
    searches: 0,
    generatedVideoSeconds: 0,
    aiRevisions: 0,
  };
}

test("concurrent reservations serialize and include in-flight usage", async () => {
  const originals = {
    transaction: sequelize.transaction,
    reelFindOne: Reels.findOne,
    counterFindOrCreate: PipelineBudgetCounter.findOrCreate,
    counterFindByPk: PipelineBudgetCounter.findByPk,
    reservationFindByPk: PipelineBudgetReservation.findByPk,
    reservationCreate: PipelineBudgetReservation.create,
  };
  const counter: Record<string, unknown> = {
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
    save: async () => {},
  };
  const reservations = new Map<string, Record<string, unknown>>();
  let tail = Promise.resolve();
  Object.assign(sequelize, {
    transaction: async (callback: (transaction: unknown) => Promise<unknown>) => {
      let release = () => {};
      const previous = tail;
      tail = new Promise<void>((resolve) => { release = resolve; });
      await previous;
      try {
        return await callback({ LOCK: { UPDATE: "UPDATE" } });
      } finally {
        release();
      }
    },
  });
  Object.assign(Reels, { findOne: async () => ({ id: pipelineId, userId }) });
  Object.assign(PipelineBudgetCounter, {
    findOrCreate: async () => [counter, false],
    findByPk: async () => counter,
  });
  Object.assign(PipelineBudgetReservation, {
    findByPk: async (id: string) => reservations.get(id) ?? null,
    create: async (values: Record<string, unknown>) => {
      const row = { ...values, save: async () => {} };
      reservations.set(String(values.id), row);
      return row;
    },
  });

  const limits: BudgetAmounts = {
    providerCalls: 1,
    inputTokens: 100,
    outputTokens: 100,
    searches: 1,
    generatedVideoSeconds: 10,
    aiRevisions: 1,
  };
  try {
    const [first, second] = await Promise.all([
      pipelineBudgetReservationRepository.reserve({
        pipelineId, userId, reservationKey: "job-a:tts:1", limits, requested: amounts(1),
      }),
      pipelineBudgetReservationRepository.reserve({
        pipelineId, userId, reservationKey: "job-b:tts:1", limits, requested: amounts(1),
      }),
    ]);
    assert.deepEqual([first.kind, second.kind].sort(), ["limit_exceeded", "reserved"]);
    assert.equal(counter.reservedProviderCalls, 1);
    assert.equal(reservations.size, 1);

    const reserved = first.kind === "reserved" ? first : second;
    await pipelineBudgetReservationRepository.finalize({
      pipelineId,
      userId,
      reservationKey: reserved.reservation.reservationKey,
      finalized: { ...amounts(1), inputTokens: 8, outputTokens: 4 },
    });
    assert.equal(counter.reservedProviderCalls, 0);
    assert.equal(counter.consumedProviderCalls, 1);
    assert.equal(counter.consumedInputTokens, "8");
    assert.equal(counter.consumedOutputTokens, "4");

    await pipelineBudgetReservationRepository.finalize({
      pipelineId,
      userId,
      reservationKey: reserved.reservation.reservationKey,
      finalized: { ...amounts(1), inputTokens: 8, outputTokens: 4 },
    });
    await assert.rejects(
      pipelineBudgetReservationRepository.release({
        pipelineId, userId, reservationKey: reserved.reservation.reservationKey,
      }),
      /cannot be released/,
    );
  } finally {
    Object.assign(sequelize, { transaction: originals.transaction });
    Object.assign(Reels, { findOne: originals.reelFindOne });
    Object.assign(PipelineBudgetCounter, {
      findOrCreate: originals.counterFindOrCreate,
      findByPk: originals.counterFindByPk,
    });
    Object.assign(PipelineBudgetReservation, {
      findByPk: originals.reservationFindByPk,
      create: originals.reservationCreate,
    });
  }
});
