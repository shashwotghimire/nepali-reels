import { randomUUID } from "node:crypto";
import { Op, type Transaction } from "sequelize";
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

const STAGE_NOT_OWNED_ERROR = "Workflow stage attempt is not owned by this worker";

function hasActiveLease(
  checkpoint: Pick<WorkflowStageAttempt, "status" | "leaseOwner" | "leaseExpiresAt">,
  leaseOwner: string,
  now = new Date(),
) {
  return checkpoint.status === "running"
    && checkpoint.leaseOwner === leaseOwner
    && Boolean(checkpoint.leaseExpiresAt && checkpoint.leaseExpiresAt.getTime() > now.getTime());
}

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
    if (running?.leaseExpiresAt && running.leaseExpiresAt.getTime() > now.getTime()) {
      return { disposition: "in_progress", checkpoint: running };
    }

    // A different execution may take over only after the old lease expires.
    // Close that row while holding the reel lock so the stale worker loses all
    // authority before the successor's attempt is created.
    if (running && running.executionKey !== input.executionKey) {
      running.status = "failed";
      running.errorMessage = "Stage lease expired and was superseded";
      running.leaseOwner = null;
      running.leaseExpiresAt = null;
      running.completedAt = now;
      await running.save({ transaction });
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
    if (!hasActiveLease(checkpoint, leaseOwner)) throw new Error(STAGE_NOT_OWNED_ERROR);
    if (!checkpoint.providerAttemptId) {
      checkpoint.providerAttemptId = randomUUID();
      await checkpoint.save({ transaction });
    }
    return checkpoint.providerAttemptId;
  });
}

export async function assertWorkflowStageLease(stageAttemptId: string, leaseOwner: string): Promise<void> {
  const checkpoint = await WorkflowStageAttempt.findByPk(stageAttemptId);
  if (!checkpoint || !hasActiveLease(checkpoint, leaseOwner)) throw new Error(STAGE_NOT_OWNED_ERROR);
}

export async function renewWorkflowStageAttempt(input: {
  stageAttemptId: string;
  leaseOwner: string;
  leaseDurationMs: number;
}) {
  if (!Number.isInteger(input.leaseDurationMs) || input.leaseDurationMs <= 0) {
    throw new Error("Stage lease duration must be a positive integer");
  }
  const now = new Date();
  const [updated] = await WorkflowStageAttempt.update({
    leaseExpiresAt: new Date(now.getTime() + input.leaseDurationMs),
  }, { where: {
    id: input.stageAttemptId,
    status: "running",
    leaseOwner: input.leaseOwner,
    leaseExpiresAt: { [Op.gt]: now },
  } });
  if (updated === 0) throw new Error(STAGE_NOT_OWNED_ERROR);
}

export async function completeWorkflowStageAttempt(input: {
  stageAttemptId: string;
  leaseOwner: string;
  output?: object | null;
}) {
  const now = new Date();
  const [updated] = await WorkflowStageAttempt.update({
    status: "succeeded",
    output: input.output ?? null,
    errorMessage: null,
    leaseOwner: null,
    leaseExpiresAt: null,
    completedAt: now,
  }, { where: {
    id: input.stageAttemptId,
    status: "running",
    leaseOwner: input.leaseOwner,
    leaseExpiresAt: { [Op.gt]: now },
  } });
  if (updated === 0) throw new Error(STAGE_NOT_OWNED_ERROR);
}

export async function failWorkflowStageAttempt(input: {
  stageAttemptId: string;
  leaseOwner: string;
  errorMessage: string;
}) {
  const now = new Date();
  const [updated] = await WorkflowStageAttempt.update({
    status: "failed",
    errorMessage: input.errorMessage,
    leaseOwner: null,
    leaseExpiresAt: null,
    completedAt: now,
  }, { where: {
    id: input.stageAttemptId,
    status: "running",
    leaseOwner: input.leaseOwner,
    leaseExpiresAt: { [Op.gt]: now },
  } });
  if (updated === 0) throw new Error(STAGE_NOT_OWNED_ERROR);
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
  leaseOwner?: string;
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
    if (input.stageAttemptId) {
      if (!input.leaseOwner) throw new Error(STAGE_NOT_OWNED_ERROR);
      const checkpoint = await WorkflowStageAttempt.findByPk(input.stageAttemptId, {
        transaction,
        lock: transaction.LOCK.UPDATE,
      });
      if (!checkpoint || checkpoint.pipelineId !== input.pipelineId || !hasActiveLease(checkpoint, input.leaseOwner)) {
        throw new Error(STAGE_NOT_OWNED_ERROR);
      }
    }
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
