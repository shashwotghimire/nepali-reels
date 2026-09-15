import fs from "node:fs";
import {
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
}) {
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
