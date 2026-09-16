import { findPipelineById, savePipelineCost } from "../../repositories/reels.repository";
import { getPipelineCostSummary } from "../../repositories/provider-usage.repository";
import { markPipelineFailedIfExecutionOwned } from "../../repositories/workflow-execution.repository";

export const markPipelineAsFailedService = async (
  pipelineId: string,
  failureReason: string | undefined,
  userId: string,
  ownership: { executionKey: string; leaseOwner: string },
) => {
  const pipeline = await findPipelineById(pipelineId, userId);
  if (!pipeline) return false;
  const transitioned = await markPipelineFailedIfExecutionOwned({
    pipelineId,
    userId,
    workflowVersion: pipeline.workflowVersion,
    executionKey: ownership.executionKey,
    leaseOwner: ownership.leaseOwner,
    ...(failureReason ? { failureReason } : {}),
  });
  if (!transitioned) return false;

  try {
    const summary = await getPipelineCostSummary(pipelineId, userId);
    // Rendering, storage and delivery have no prices in the ledger yet.
    await savePipelineCost(pipelineId, userId, summary.knownCostUsd, true);
  } catch (error) {
    console.error(`[pipeline:${pipelineId}] failed to sync cost during failure handling:`, error);
  }
  return true;
};
