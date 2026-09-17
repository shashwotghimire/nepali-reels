import { completeThumbnailRegeneration, failThumbnailRegeneration, findPipelineById, markThumbnailRegenerationSubmitted, markThumbnailRegenerationUncertain, reserveThumbnailRegeneration, saveThumbnailRegenerationProviderResult, selectThumbnailVersion } from "../../repositories/reels.repository";
import { resolveServerGenerationAccess } from "./entitlement-resolution.service";
import { generateThumbnailOpenRouter } from "./agents/thumbnail.agent";
import { uploadThumbnailToS3 } from "../s3.service";
import { ApiError } from "../../utils/ApiError.util";
import type { VideoSpec } from "../../schema/video-spec.schema";
import { createProviderBudgetContext } from "./provider-budget.service";
import { getPipelineCostSummary } from "../../repositories/provider-usage.repository";
import { savePipelineCost } from "../../repositories/reels.repository";
import { abandonUncertainThumbnailRegeneration } from "../../repositories/reels.repository";

export async function regenerateThumbnailService(userId: string, pipelineId: string, idempotencyKey: string) {
  const access = await resolveServerGenerationAccess(userId);
  const pipeline = await findPipelineById(pipelineId, userId);
  if (!pipeline?.videoSpec) throw new ApiError(404, "Rendered reel not found", "Not found");
  const reservation = await reserveThumbnailRegeneration({ pipelineId, userId, idempotencyKey, limit: access.entitlement.thumbnailRegenerationsPerVideo });
  if (reservation.state === "completed") return reservation.pipeline;
  if (reservation.state === "running") throw new ApiError(409, "Thumbnail regeneration is already running", "Conflict");
  if (reservation.state === "uncertain") throw new ApiError(409, "Thumbnail provider outcome is uncertain; no retry was sent", "Thumbnail needs reconciliation");
  if (reservation.state === "consumed") throw new ApiError(409, "This uncertain thumbnail was acknowledged and its entitlement remains consumed", "Thumbnail was abandoned");
  const version = reservation.version;
  const metering = { userId, pipelineId, stage: "thumbnail_regeneration", budget: createProviderBudgetContext(pipelineId, access) };
  try {
  if (reservation.state === "reserved") {
    await markThumbnailRegenerationSubmitted(pipelineId, userId, idempotencyKey, reservation.leaseOwner);
    try { const { data } = await generateThumbnailOpenRouter(
    pipeline.videoSpec as VideoSpec, pipeline.claudeModel, "google/gemini-3.1-flash-image",
    metering,
  );
  const uploaded = await uploadThumbnailToS3(data, pipelineId, version);
    await saveThumbnailRegenerationProviderResult(pipelineId, userId, idempotencyKey, reservation.leaseOwner, uploaded.url);
    } catch (error) {
      await markThumbnailRegenerationUncertain(pipelineId, userId, idempotencyKey, reservation.leaseOwner, error instanceof Error ? error.message : String(error));
      throw error;
    }
  }
  const result = await completeThumbnailRegeneration({ pipelineId, userId, idempotencyKey, leaseOwner: reservation.leaseOwner });
  const summary = await getPipelineCostSummary(pipelineId, userId);
  await savePipelineCost(pipelineId, userId, summary.knownCostUsd, true);
  return result;
  } catch (error) { if (reservation.state === "reserved") await failThumbnailRegeneration(pipelineId, userId, idempotencyKey, reservation.leaseOwner, error instanceof Error ? error.message : String(error)); throw error; }
}

export const selectThumbnailVersionService = (userId: string, pipelineId: string, version: number) =>
  selectThumbnailVersion(pipelineId, userId, version);
export const abandonUncertainThumbnailService = (userId: string, pipelineId: string, idempotencyKey: string) =>
  abandonUncertainThumbnailRegeneration(pipelineId, userId, idempotencyKey);
