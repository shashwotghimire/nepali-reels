import { createHash } from "node:crypto";

export function workflowArtifactKey(
  workflowVersion: number,
  kind: string,
  identity: string,
): string {
  return `v${workflowVersion}/${kind}/${identity}`;
}

export function stableFingerprint(value: unknown): string {
  return createHash("sha256").update(JSON.stringify(value)).digest("hex");
}

export function workflowStorageKey(
  pipelineId: string,
  artifactKey: string,
  extension: string,
  writeIdentity?: string,
): string {
  const safeArtifactKey = artifactKey.replace(/[^a-zA-Z0-9/_-]/g, "_");
  const safeExtension = extension.replace(/[^a-zA-Z0-9]/g, "");
  const safeWriteIdentity = writeIdentity?.replace(/[^a-zA-Z0-9_-]/g, "_");
  return `workflow/${pipelineId}/${safeArtifactKey}${safeWriteIdentity ? `.${safeWriteIdentity}` : ""}.${safeExtension}`;
}
