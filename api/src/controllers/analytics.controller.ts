import { Request, Response } from "express";
import asyncHandler from "../utils/asyncHandler.util";
import { ApiResponse } from "../utils/ApiResponse.util";
import { getLatestAnalyticsService, getAllAnalyticsService } from "../services/analytics.service";

export const getLatestAnalytics = asyncHandler(async (req: Request, res: Response) => {
  const userId = res.locals.user.id;
  const result = await getLatestAnalyticsService(userId);
  res.status(200).json(new ApiResponse(true, "Analytics fetched successfully", result));
});

export const getAllAnalytics = asyncHandler(async (req: Request, res: Response) => {
  const userId = res.locals.user.id;
  const result = await getAllAnalyticsService(userId);
  res.status(200).json(new ApiResponse(true, "Analytics history fetched successfully", result));
});
