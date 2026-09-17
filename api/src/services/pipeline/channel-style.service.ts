import { randomUUID } from "node:crypto";
import { deleteChannelStyle, findChannelStyle, listChannelStyles, reserveChannelStyleSlot, setChannelStyleLogo } from "../../repositories/channel-style.repository";
import { resolveServerGenerationAccess } from "./entitlement-resolution.service";
import { uploadChannelLogoToS3 } from "../s3.service";
import { ApiError } from "../../utils/ApiError.util";
import type { ChannelStyleSnapshot } from "../../types/pipeline.types";

export const getChannelStylesService = (userId: string) => listChannelStyles(userId);

export async function createChannelStyleService(userId: string, input: { name: string; channelName: string; captionPreset: "default" | "bold" | "minimal"; logo?: Express.Multer.File }) {
  const access = await resolveServerGenerationAccess(userId);
  if (!access.entitlement.channelOverlay || access.entitlement.styleSlots < 1) throw new ApiError(403, "Saved styles are unavailable", "Forbidden");
  if (input.captionPreset !== "default" && !access.entitlement.captionPresets) throw new ApiError(403, "Caption presets are unavailable", "Forbidden");
  const styleId = randomUUID();
  let style;
  try { style = await reserveChannelStyleSlot({ id: styleId, userId, name: input.name, channelName: input.channelName, captionPreset: input.captionPreset, limit: access.entitlement.styleSlots }); }
  catch (error) { throw new ApiError(403, error instanceof Error ? error.message : "Saved style limit reached", "Forbidden"); }
  if (!input.logo) return style;
  try {
    const uploaded = await uploadChannelLogoToS3(input.logo.buffer, userId, styleId, input.logo.mimetype);
    return setChannelStyleLogo(userId, styleId, uploaded.url);
  } catch (error) { await deleteChannelStyle(userId, styleId); throw error; }
}

export async function deleteChannelStyleService(userId: string, id: string) {
  if (!(await deleteChannelStyle(userId, id))) throw new ApiError(404, "Style not found", "Not found");
}

export async function resolveStyleSnapshot(userId: string, id?: string): Promise<ChannelStyleSnapshot | null> {
  if (!id) return null;
  const access = await resolveServerGenerationAccess(userId);
  if (!access.entitlement.channelOverlay) throw new ApiError(403, "Channel overlays are unavailable", "Forbidden");
  const style = await findChannelStyle(userId, id);
  if (!style) throw new ApiError(404, "Style not found", "Not found");
  return { id: style.id, name: style.name, channelName: style.channelName, logoUrl: style.logoUrl, captionPreset: style.captionPreset };
}
