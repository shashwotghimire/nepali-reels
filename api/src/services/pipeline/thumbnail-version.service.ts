import { findPipelineById, completeThumbnailRegeneration, releaseThumbnailRegeneration, reserveThumbnailRegeneration, selectThumbnailVersion } from "../../repositories/reels.repository";
import { resolveServerGenerationAccess } from "./entitlement-resolution.service";
import { generateThumbnailOpenRouter } from "./agents/thumbnail.agent";
import { uploadThumbnailToS3 } from "../s3.service";
import { ApiError } from "../../utils/ApiError.util";
import type { VideoSpec } from "../../schema/video-spec.schema";
import { createProviderBudgetContext } from "./provider-budget.service";
import { getPipelineCostSummary } from "../../repositories/provider-usage.repository";
import { savePipelineCost } from "../../repositories/reels.repository";

export async function regenerateThumbnailService(userId: string, pipelineId: string, idempotencyKey: string) {
  const access = await resolveServerGenerationAccess(userId);
  const pipeline = await findPipelineById(pipelineId, userId);
  if (!pipeline?.videoSpec) throw new ApiError(404, "Rendered reel not found", "Not found");
  const reservation = await reserveThumbnailRegeneration({ pipelineId, userId, idempotencyKey, limit: access.entitlement.thumbnailRegenerationsPerVideo });
  if (reservation.state === "completed") return reservation.pipeline;
  if (reservation.state === "running") throw new ApiError(409, "Thumbnail regeneration is already running", "Conflict");
  const version = reservation.version;
  const metering = { userId, pipelineId, stage: "thumbnail_regeneration", budget: createProviderBudgetContext(pipelineId, access) };
  try { const { data } = await generateThumbnailOpenRouter(
    pipeline.videoSpec as VideoSpec, pipeline.claudeModel, "google/gemini-3.1-flash-image",
    metering,
  );
  const uploaded = await uploadThumbnailToS3(data, pipelineId, version);
  const result = await completeThumbnailRegeneration({ pipelineId, userId, idempotencyKey, url: uploaded.url });
  const summary = await getPipelineCostSummary(pipelineId, userId);
  await savePipelineCost(pipelineId, userId, summary.knownCostUsd, true);
  return result;
  } catch (error) { await releaseThumbnailRegeneration(pipelineId, userId, idempotencyKey); throw error; }
}

export const selectThumbnailVersionService = (userId: string, pipelineId: string, version: number) =>
  selectThumbnailVersion(pipelineId, userId, version);
