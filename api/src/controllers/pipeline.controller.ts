import { Request, Response } from "express";
import asyncHandler from "../utils/asyncHandler.util";
import { ApiResponse } from "../utils/ApiResponse.util";
import { pipelineService } from "../services/pipeline/pipeline.service";

export const generateScript = asyncHandler(
  async (req: Request, res: Response) => {
    const { topic } = req.body;
    const result = await pipelineService(topic);
    res
      .status(200)
      .json(new ApiResponse(true, "Script generated successfully", result));
  },
);
