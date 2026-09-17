import { Request, Response } from "express";
import asyncHandler from "../utils/asyncHandler.util";
import { ApiResponse } from "../utils/ApiResponse.util";
import { createChannelStyleService, deleteChannelStyleService, getChannelStylesService } from "../services/pipeline/channel-style.service";

export const getChannelStyles = asyncHandler(async (_req: Request, res: Response) => {
  res.json(new ApiResponse(true, "Styles fetched", await getChannelStylesService(res.locals.user.id)));
});
export const createChannelStyle = asyncHandler(async (req: Request, res: Response) => {
  const result = await createChannelStyleService(res.locals.user.id, {
    name: req.body.name,
    channelName: req.body.channelName,
    captionPreset: req.body.captionPreset ?? "default",
    ...(req.file ? { logo: req.file } : {}),
  });
  res.status(201).json(new ApiResponse(true, "Style created", result));
});
export const deleteChannelStyle = asyncHandler(async (req: Request, res: Response) => {
  await deleteChannelStyleService(res.locals.user.id, req.params.id as string);
  res.json(new ApiResponse(true, "Style deleted", null));
});
