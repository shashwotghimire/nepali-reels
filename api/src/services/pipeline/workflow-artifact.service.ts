import fs from "node:fs";
import {
  assertWorkflowStageLease,
  findWorkflowArtifact,
  putWorkflowArtifact,
} from "../../repositories/workflow-execution.repository";
import {
  downloadWorkflowFile,
  uploadWorkflowFile,
} from "../s3.service";
import { workflowStorageKey } from "../../helpers/workflow-artifact.helper";

export async function persistWorkflowFile(input: {
  pipelineId: string;
  userId: string;
  artifactKey: string;
  kind: string;
  filePath: string;
  extension: string;
  contentType: string;
  fingerprint?: string;
  metadata?: object;
  stageAttemptId?: string;
  leaseOwner?: string;
}) {
  if (input.stageAttemptId) {
    if (!input.leaseOwner) throw new Error("Workflow stage attempt is not owned by this worker");
    await assertWorkflowStageLease(input.stageAttemptId, input.leaseOwner);
  }
  const storageKey = workflowStorageKey(
    input.pipelineId,
    input.artifactKey,
    input.extension,
  );
  const uploaded = await uploadWorkflowFile(input.filePath, storageKey, input.contentType);
  return putWorkflowArtifact({
    pipelineId: input.pipelineId,
    userId: input.userId,
    artifactKey: input.artifactKey,
    kind: input.kind,
    storageProvider: "s3",
    storageKey,
    contentType: input.contentType,
    byteSize: uploaded.byteSize,
    ...(input.fingerprint ? { fingerprint: input.fingerprint } : {}),
    ...(input.metadata ? { metadata: input.metadata } : {}),
    ...(input.stageAttemptId ? { stageAttemptId: input.stageAttemptId, leaseOwner: input.leaseOwner } : {}),
  });
}

export async function restoreWorkflowFile(input: {
  pipelineId: string;
  userId: string;
  artifactKey: string;
  destination: string;
  fingerprint?: string;
}): Promise<boolean> {
  const artifact = await findWorkflowArtifact({
    pipelineId: input.pipelineId,
    userId: input.userId,
    artifactKey: input.artifactKey,
  });
  if (!artifact || artifact.storageProvider !== "s3") return false;
  if (input.fingerprint && artifact.fingerprint !== input.fingerprint) return false;
  await downloadWorkflowFile(artifact.storageKey, input.destination);
  return fs.existsSync(input.destination);
}

export async function persistInlineWorkflowArtifact(input: {
  pipelineId: string;
  userId: string;
  artifactKey: string;
  kind: string;
  metadata: object;
  fingerprint?: string;
  stageAttemptId?: string;
  leaseOwner?: string;
}) {
  return putWorkflowArtifact({
    pipelineId: input.pipelineId,
    userId: input.userId,
    artifactKey: input.artifactKey,
    kind: input.kind,
    storageProvider: "database",
    storageKey: input.artifactKey,
    metadata: input.metadata,
    ...(input.fingerprint ? { fingerprint: input.fingerprint } : {}),
    ...(input.stageAttemptId ? { stageAttemptId: input.stageAttemptId, leaseOwner: input.leaseOwner } : {}),
  });
}

export async function getInlineWorkflowArtifact(input: {
  pipelineId: string;
  userId: string;
  artifactKey: string;
}) {
  const artifact = await findWorkflowArtifact(input);
  return artifact?.storageProvider === "database" ? artifact.metadata : null;
}

export async function getWorkflowArtifactDetails(input: {
  pipelineId: string;
  userId: string;
  artifactKey: string;
}) {
  const artifact = await findWorkflowArtifact(input);
  if (!artifact) return null;
  return {
    artifactKey: artifact.artifactKey,
    storageProvider: artifact.storageProvider,
    storageKey: artifact.storageKey,
    fingerprint: artifact.fingerprint,
    metadata: artifact.metadata,
  };
}
