import { markPipelineAsFailed, savePipelineCost } from "../../repositories/reels.repository";
import { getPipelineCostSummary } from "../../repositories/provider-usage.repository";

export const markPipelineAsFailedService = async (
  pipelineId: string,
  failureReason?: string,
  userId?: string,
) => {
  if (userId) {
    try {
      const summary = await getPipelineCostSummary(pipelineId, userId);
      // Rendering, storage and delivery have no prices in the ledger yet.
      await savePipelineCost(pipelineId, userId, summary.knownCostUsd, true);
    } catch (error) {
      console.error(`[pipeline:${pipelineId}] failed to sync cost during failure handling:`, error);
    }
  }
  await markPipelineAsFailed(pipelineId, failureReason);
};
