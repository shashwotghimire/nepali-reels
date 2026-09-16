import {
  assertWorkflowStageLease,
  claimWorkflowStageAttempt,
  completeWorkflowStageAttempt,
  failWorkflowStageAttempt,
  hasWorkflowStageAttempts,
  renewWorkflowStageAttempt,
  seedSucceededWorkflowStages,
} from "../../repositories/workflow-execution.repository";
import { randomUUID } from "node:crypto";
import {
  EXPLAINER_WORKFLOW_VERSION,
  inferLegacyCompletedStages,
  type ExplainerStage,
  type LegacyPipelineProgress,
} from "../../helpers/workflow.helper";
import type { WorkflowCheckpointPort } from "./workflow-dispatcher.service";
import fs from "node:fs";
import { workflowArtifactKey, stableFingerprint } from "../../helpers/workflow-artifact.helper";
import { persistWorkflowFile } from "./workflow-artifact.service";
import { saveAudioSpec } from "../../repositories/reels.repository";

const STAGE_LEASE_MS = 25 * 60 * 1_000;

interface LegacyAdoptionDependencies {
  hasAttempts: typeof hasWorkflowStageAttempts;
  seedStages: typeof seedSucceededWorkflowStages;
  fileExists(filePath: string): boolean;
  persistFile: typeof persistWorkflowFile;
  saveSoundSpec: typeof saveAudioSpec;
}

const legacyAdoptionDependencies: LegacyAdoptionDependencies = {
  hasAttempts: hasWorkflowStageAttempts,
  seedStages: seedSucceededWorkflowStages,
  fileExists: fs.existsSync,
  persistFile: persistWorkflowFile,
  saveSoundSpec: saveAudioSpec,
};

export async function seedLegacyExplainerCheckpoints(input: {
  pipelineId: string;
  userId: string;
  pipeline: LegacyPipelineProgress;
}, dependencies: LegacyAdoptionDependencies = legacyAdoptionDependencies) {
  // Legacy fields are adopted once. Once a versioned checkpoint exists, those
  // fields belong to the current workflow and must never be reinterpreted.
  if (await dependencies.hasAttempts({
    pipelineId: input.pipelineId,
    userId: input.userId,
    workflowVersion: EXPLAINER_WORKFLOW_VERSION,
  })) return;

  const soundSpec = input.pipeline.soundSpec as {
    audioFilePath?: string;
    artifactKey?: string;
  } | null;
  if (soundSpec?.audioFilePath && !soundSpec.artifactKey && dependencies.fileExists(soundSpec.audioFilePath)) {
    const artifactKey = workflowArtifactKey(
      EXPLAINER_WORKFLOW_VERSION,
      "audio",
      "narration",
    );
    await dependencies.persistFile({
      pipelineId: input.pipelineId,
      userId: input.userId,
      artifactKey,
      kind: "audio",
      filePath: soundSpec.audioFilePath,
      extension: "wav",
      contentType: "audio/wav",
      fingerprint: stableFingerprint({ legacyAudioPath: soundSpec.audioFilePath }),
    });
    soundSpec.artifactKey = artifactKey;
    await dependencies.saveSoundSpec(input.pipelineId, input.userId, soundSpec);
  }
  const stages = inferLegacyCompletedStages(input.pipeline);
  if (stages.length === 0) return;
  await dependencies.seedStages({
    pipelineId: input.pipelineId,
    userId: input.userId,
    workflowVersion: EXPLAINER_WORKFLOW_VERSION,
    stages: stages.map((stage) => ({
      stage,
      executionKey: `legacy:${stage}`,
    })),
  });
}

export function createWorkflowCheckpointPort(
  executionIdentity: string,
  leaseOwner = createWorkflowLeaseOwner(executionIdentity),
): WorkflowCheckpointPort {
  // BullMQ reuses a job id when the same queue job is replayed. A fresh token
  // per port instance fences the prior worker incarnation even in that case.
  const claimedIds = new Map<ExplainerStage, string>();
  return {
    leaseRenewalIntervalMs: Math.floor(STAGE_LEASE_MS / 3),
    async claim(input) {
      const result = await claimWorkflowStageAttempt({
        ...input,
        leaseOwner,
        leaseDurationMs: STAGE_LEASE_MS,
      });
      if (result.disposition === "reuse") {
        return { state: "succeeded", output: result.checkpoint.output };
      }
      if (result.disposition === "in_progress") return { state: "in_progress" };
      if (result.disposition === "failed") {
        throw new Error(`Workflow execution ${input.executionKey} already failed at ${input.stage}`);
      }
      claimedIds.set(input.stage, result.checkpoint.id);
      const stageAttemptId = result.checkpoint.id;
      return {
        state: "claimed",
        lease: {
          stageAttemptId,
          leaseOwner,
          assertOwned: () => assertWorkflowStageLease(stageAttemptId, leaseOwner),
        },
      };
    },
    async renew(input) {
      const stageAttemptId = claimedIds.get(input.stage);
      if (!stageAttemptId) throw new Error(`No claimed checkpoint for ${input.stage}`);
      await renewWorkflowStageAttempt({ stageAttemptId, leaseOwner, leaseDurationMs: STAGE_LEASE_MS });
    },
    async complete(input) {
      const stageAttemptId = claimedIds.get(input.stage);
      if (!stageAttemptId) throw new Error(`No claimed checkpoint for ${input.stage}`);
      await completeWorkflowStageAttempt({
        stageAttemptId,
        leaseOwner,
        output: input.output ?? null,
      });
    },
    async fail(input) {
      const stageAttemptId = claimedIds.get(input.stage);
      if (!stageAttemptId) return;
      await failWorkflowStageAttempt({
        stageAttemptId,
        leaseOwner,
        errorMessage: input.error,
      });
    },
  };
}

export function createWorkflowLeaseOwner(executionIdentity: string): string {
  return `${executionIdentity}:${randomUUID()}`;
}
