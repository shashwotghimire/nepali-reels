import { randomUUID } from "node:crypto";
import type { Transaction } from "sequelize";
import sequelize from "../configs/db.config";
import Reels from "../models/reels.model";
import WorkflowArtifact from "../models/workflow-artifact.model";
import WorkflowStageAttempt from "../models/workflow-stage-attempt.model";

async function requireOwnedPipeline(
  pipelineId: string,
  userId: string,
  transaction?: Transaction,
  lockForUpdate = false,
) {
  const pipeline = await Reels.findOne({
    where: { id: pipelineId, userId },
    ...(transaction ? { transaction } : {}),
    ...(transaction && lockForUpdate ? { lock: transaction.LOCK.UPDATE } : {}),
  });
  if (!pipeline) throw new Error("Reel not found");
  return pipeline;
}

export interface SeedSucceededWorkflowStage {
  stage: string;
  executionKey: string;
  output?: object | null;
}

export async function hasWorkflowStageAttempts(input: {
  pipelineId: string;
  userId: string;
  workflowVersion: number;
}): Promise<boolean> {
  await requireOwnedPipeline(input.pipelineId, input.userId);
  return (await WorkflowStageAttempt.count({
    where: {
      pipelineId: input.pipelineId,
      workflowVersion: input.workflowVersion,
    },
  })) > 0;
}

export async function seedSucceededWorkflowStages(input: {
  pipelineId: string;
  userId: string;
  workflowVersion: number;
  stages: SeedSucceededWorkflowStage[];
}) {
  return sequelize.transaction(async (transaction) => {
    await requireOwnedPipeline(input.pipelineId, input.userId, transaction);
    const now = new Date();
    const checkpoints: WorkflowStageAttempt[] = [];
    for (const stage of input.stages) {
      const [checkpoint, created] = await WorkflowStageAttempt.findOrCreate({
        where: {
          pipelineId: input.pipelineId,
          workflowVersion: input.workflowVersion,
          stage: stage.stage,
          executionKey: stage.executionKey,
        },
        defaults: {
          id: randomUUID(),
          pipelineId: input.pipelineId,
          workflowVersion: input.workflowVersion,
          stage: stage.stage,
          executionKey: stage.executionKey,
          status: "succeeded",
          input: null,
          output: stage.output ?? null,
          leaseOwner: null,
          leaseExpiresAt: null,
          startedAt: now,
          completedAt: now,
        },
        transaction,
      });
      if (!created && checkpoint.status !== "succeeded") {
        checkpoint.status = "succeeded";
        checkpoint.output = stage.output ?? null;
        checkpoint.errorMessage = null;
        checkpoint.leaseOwner = null;
        checkpoint.leaseExpiresAt = null;
        checkpoint.completedAt = now;
        await checkpoint.save({ transaction });
      }
      checkpoints.push(checkpoint);
    }
    return checkpoints;
  });
}

export type ClaimWorkflowStageResult =
  | { disposition: "claimed"; checkpoint: WorkflowStageAttempt }
  | { disposition: "in_progress"; checkpoint: WorkflowStageAttempt }
  | { disposition: "reuse"; checkpoint: WorkflowStageAttempt }
  | { disposition: "failed"; checkpoint: WorkflowStageAttempt };

export async function claimWorkflowStageAttempt(input: {
  pipelineId: string;
  userId: string;
  workflowVersion: number;
  stage: string;
  executionKey: string;
  leaseOwner: string;
  leaseDurationMs: number;
  stageInput?: object | null;
}): Promise<ClaimWorkflowStageResult> {
  if (!Number.isInteger(input.leaseDurationMs) || input.leaseDurationMs <= 0) {
    throw new Error("Stage lease duration must be a positive integer");
  }
  return sequelize.transaction(async (transaction) => {
    // The attempt row does not exist on a stage's first claim, so locking an
    // attempt query cannot serialize competing inserts. Every stage belongs to
    // this stable reel row; locking it makes claim inspection and creation one
    // critical section across execution keys.
    await requireOwnedPipeline(input.pipelineId, input.userId, transaction, true);
    const now = new Date();
    const leaseExpiresAt = new Date(now.getTime() + input.leaseDurationMs);
    const succeeded = await WorkflowStageAttempt.findOne({
      where: {
        pipelineId: input.pipelineId,
        workflowVersion: input.workflowVersion,
        stage: input.stage,
        status: "succeeded",
      },
      order: [["completedAt", "DESC"]],
      transaction,
    });
    if (succeeded) return { disposition: "reuse", checkpoint: succeeded };

    const running = await WorkflowStageAttempt.findOne({
      where: {
        pipelineId: input.pipelineId,
        workflowVersion: input.workflowVersion,
        stage: input.stage,
        status: "running",
      },
      order: [["createdAt", "DESC"]],
      transaction,
      lock: transaction.LOCK.UPDATE,
    });
    if (
      running &&
      running.executionKey !== input.executionKey &&
      running.leaseExpiresAt &&
      running.leaseExpiresAt.getTime() > now.getTime()
    ) {
      return { disposition: "in_progress", checkpoint: running };
    }

    const [checkpoint, created] = await WorkflowStageAttempt.findOrCreate({
      where: {
        pipelineId: input.pipelineId,
        workflowVersion: input.workflowVersion,
        stage: input.stage,
        executionKey: input.executionKey,
      },
      defaults: {
        id: randomUUID(),
        pipelineId: input.pipelineId,
        workflowVersion: input.workflowVersion,
        stage: input.stage,
        executionKey: input.executionKey,
        status: "running",
        leaseOwner: input.leaseOwner,
        leaseExpiresAt,
        input: input.stageInput ?? null,
        startedAt: now,
      },
      transaction,
    });
    if (created) return { disposition: "claimed", checkpoint };

    await checkpoint.reload({ transaction, lock: transaction.LOCK.UPDATE });
    if (checkpoint.status === "succeeded") return { disposition: "reuse", checkpoint };
    if (checkpoint.status === "failed") return { disposition: "failed", checkpoint };
    if (checkpoint.leaseExpiresAt && checkpoint.leaseExpiresAt.getTime() > now.getTime()) {
      return { disposition: "in_progress", checkpoint };
    }

    checkpoint.leaseOwner = input.leaseOwner;
    checkpoint.leaseExpiresAt = leaseExpiresAt;
    await checkpoint.save({ transaction });
    return { disposition: "claimed", checkpoint };
  });
}

/** Persist once before submission; a replay receives the same provider attempt identity. */
export async function ensureStageProviderAttemptId(stageAttemptId: string, leaseOwner: string): Promise<string> {
  return sequelize.transaction(async (transaction) => {
    const checkpoint = await WorkflowStageAttempt.findByPk(stageAttemptId, {
      transaction,
      lock: transaction.LOCK.UPDATE,
    });
    if (!checkpoint) throw new Error("Workflow stage attempt not found");
    if (checkpoint.status !== "running" || checkpoint.leaseOwner !== leaseOwner) {
      throw new Error("Workflow stage attempt is not owned by this worker");
    }
    if (!checkpoint.providerAttemptId) {
      checkpoint.providerAttemptId = randomUUID();
      await checkpoint.save({ transaction });
    }
    return checkpoint.providerAttemptId;
  });
}

export async function completeWorkflowStageAttempt(input: {
  stageAttemptId: string;
  leaseOwner: string;
  output?: object | null;
}) {
  const [updated] = await WorkflowStageAttempt.update({
    status: "succeeded",
    output: input.output ?? null,
    errorMessage: null,
    leaseOwner: null,
    leaseExpiresAt: null,
    completedAt: new Date(),
  }, { where: { id: input.stageAttemptId, status: "running", leaseOwner: input.leaseOwner } });
  if (updated === 0) throw new Error("Workflow stage attempt is not owned by this worker");
}

export async function failWorkflowStageAttempt(input: {
  stageAttemptId: string;
  leaseOwner: string;
  errorMessage: string;
}) {
  const [updated] = await WorkflowStageAttempt.update({
    status: "failed",
    errorMessage: input.errorMessage,
    leaseOwner: null,
    leaseExpiresAt: null,
    completedAt: new Date(),
  }, { where: { id: input.stageAttemptId, status: "running", leaseOwner: input.leaseOwner } });
  if (updated === 0) throw new Error("Workflow stage attempt is not owned by this worker");
}

export async function getWorkflowStageAttempt(input: {
  pipelineId: string;
  userId: string;
  workflowVersion: number;
  stage: string;
  executionKey: string;
}) {
  await requireOwnedPipeline(input.pipelineId, input.userId);
  return WorkflowStageAttempt.findOne({ where: {
    pipelineId: input.pipelineId,
    workflowVersion: input.workflowVersion,
    stage: input.stage,
    executionKey: input.executionKey,
  } });
}

export async function findSucceededWorkflowStage(input: {
  pipelineId: string;
  userId: string;
  workflowVersion: number;
  stage: string;
}): Promise<WorkflowStageAttempt | null> {
  await requireOwnedPipeline(input.pipelineId, input.userId);
  return WorkflowStageAttempt.findOne({
    where: {
      pipelineId: input.pipelineId,
      workflowVersion: input.workflowVersion,
      stage: input.stage,
      status: "succeeded",
    },
    order: [["completedAt", "DESC"]],
  });
}

export interface PutWorkflowArtifactInput {
  pipelineId: string;
  userId: string;
  stageAttemptId?: string | null;
  artifactKey: string;
  kind: string;
  storageProvider: string;
  storageKey: string;
  contentType?: string | null;
  byteSize?: string | number | null;
  checksum?: string | null;
  fingerprint?: string | null;
  metadata?: object | null;
}

/** Deterministic keys make this a replay-safe insert or explicit superseding update. */
export async function putWorkflowArtifact(input: PutWorkflowArtifactInput) {
  return sequelize.transaction(async (transaction) => {
    await requireOwnedPipeline(input.pipelineId, input.userId, transaction);
    const existing = await WorkflowArtifact.findOne({
      where: { pipelineId: input.pipelineId, artifactKey: input.artifactKey },
      transaction,
      lock: transaction.LOCK.UPDATE,
    });
    const values = {
      stageAttemptId: input.stageAttemptId ?? null,
      kind: input.kind,
      storageProvider: input.storageProvider,
      storageKey: input.storageKey,
      contentType: input.contentType ?? null,
      byteSize: input.byteSize == null ? null : String(input.byteSize),
      checksum: input.checksum ?? null,
      fingerprint: input.fingerprint ?? null,
      metadata: input.metadata ?? null,
    };
    if (existing) {
      await existing.update(values, { transaction });
      return { artifact: existing, created: false };
    }
    const artifact = await WorkflowArtifact.create({
      id: randomUUID(),
      pipelineId: input.pipelineId,
      artifactKey: input.artifactKey,
      ...values,
    }, { transaction });
    return { artifact, created: true };
  });
}

export async function findWorkflowArtifact(input: {
  pipelineId: string;
  userId: string;
  artifactKey?: string;
  fingerprint?: string;
}) {
  await requireOwnedPipeline(input.pipelineId, input.userId);
  if (!input.artifactKey && !input.fingerprint) throw new Error("Artifact key or fingerprint is required");
  return WorkflowArtifact.findOne({ where: {
    pipelineId: input.pipelineId,
    ...(input.artifactKey ? { artifactKey: input.artifactKey } : {}),
    ...(input.fingerprint ? { fingerprint: input.fingerprint } : {}),
  } });
}

export async function listWorkflowArtifacts(pipelineId: string, userId: string) {
  await requireOwnedPipeline(pipelineId, userId);
  return WorkflowArtifact.findAll({ where: { pipelineId }, order: [["createdAt", "ASC"]] });
}
