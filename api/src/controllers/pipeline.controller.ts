import { Request, Response } from "express";
import asyncHandler from "../utils/asyncHandler.util";
import { ApiResponse } from "../utils/ApiResponse.util";
import { createPipelineService } from "../services/pipeline/pipeline.service";
import {
  getReelsService,
  getPipelineByIdService,
} from "../services/reels.service";

export const getPipelineById = asyncHandler(
  async (req: Request, res: Response) => {
    const userId = res.locals.user.id;
    const id = req.params.id as string;
    const result = await getPipelineByIdService(userId, id);
    res
      .status(200)
      .json(new ApiResponse(true, "Pipeline fetched successfully", result));
  },
);

export const getReels = asyncHandler(async (req: Request, res: Response) => {
  const userId = res.locals.user.id;
  const page = parseInt(req.query.page as string) || 1;
  const limit = parseInt(req.query.limit as string) || 10;
  const search =
    typeof req.query.search === "string" ? req.query.search : undefined;
  const result = await getReelsService(userId, page, limit, search);
  res
    .status(200)
    .json(new ApiResponse(true, "Reels fetched successfully", result));
});

export const generateScript = asyncHandler(
  async (req: Request, res: Response) => {
    const { topic } = req.body;
    const userId = res.locals.user.id;
    const result = await createPipelineService(userId, topic);
    res
      .status(200)
      .json(new ApiResponse(true, "Script generated successfully", result));
  },
);
