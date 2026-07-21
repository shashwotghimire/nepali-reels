import path from "path";
import fs from "fs";
import { Request, Response } from "express";
import asyncHandler from "../utils/asyncHandler.util";
import { ApiResponse } from "../utils/ApiResponse.util";
import { pipelineQueue } from "../queue/pipeline.queue";
import { initPipelineService } from "../services/pipeline/pipeline.service";
import {
  getReelsService,
  getPipelineByIdService,
  deletePipelineService,
} from "../services/reels.service";
import { getS3PresignedUrl } from "../services/s3.service";

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

export const getPipelineAudio = asyncHandler(
  async (req: Request, res: Response) => {
    const userId = res.locals.user.id;
    const id = req.params.id as string;

    const pipeline = await getPipelineByIdService(userId, id);
    if (!pipeline) {
      res.status(404).json(new ApiResponse(false, "Pipeline not found", null));
      return;
    }

    const audioPath = path.resolve(`src/audio/${id}.wav`);
    if (!fs.existsSync(audioPath)) {
      res
        .status(404)
        .json(new ApiResponse(false, "Audio not yet generated", null));
      return;
    }

    const stat = fs.statSync(audioPath);
    const fileSize = stat.size;
    const range = req.headers.range;

    res.setHeader("Content-Type", "audio/wav");
    res.setHeader("Content-Disposition", `inline; filename="${id}.wav"`);
    res.setHeader("Accept-Ranges", "bytes");

    if (range) {
      const [startStr, endStr] = range.replace(/bytes=/, "").split("-");
      const start = parseInt(startStr ?? "0", 10);
      const end = endStr ? parseInt(endStr, 10) : fileSize - 1;
      res.setHeader("Content-Range", `bytes ${start}-${end}/${fileSize}`);
      res.setHeader("Content-Length", end - start + 1);
      res.status(206);
      fs.createReadStream(audioPath, { start, end }).pipe(res);
    } else {
      res.setHeader("Content-Length", fileSize);
      res.status(200);
      fs.createReadStream(audioPath).pipe(res);
    }
  },
);

export const getPipelineVideo = asyncHandler(
  async (req: Request, res: Response) => {
    const userId = res.locals.user.id;
    const id = req.params.id as string;

    const pipeline = await getPipelineByIdService(userId, id);
    if (!pipeline) {
      res.status(404).json(new ApiResponse(false, "Pipeline not found", null));
      return;
    }

    if (pipeline.s3key) {
      if (process.env.AWS_CLOUDFRONT_DOMAIN) {
        const cdnUrl = `https://${process.env.AWS_CLOUDFRONT_DOMAIN}/${pipeline.s3key}`;
        res.redirect(cdnUrl);
      } else {
        const presignedUrl = await getS3PresignedUrl(pipeline.s3key);
        res.redirect(presignedUrl);
      }
      return;
    }

    const videoPath = path.resolve(`src/video/${id}-output.mp4`);
    if (!fs.existsSync(videoPath)) {
      res
        .status(404)
        .json(new ApiResponse(false, "Video not yet generated", null));
      return;
    }

    const stat = fs.statSync(videoPath);
    const fileSize = stat.size;
    const range = req.headers.range;

    res.setHeader("Content-Type", "video/mp4");
    res.setHeader("Content-Disposition", `inline; filename="${id}-output.mp4"`);
    res.setHeader("Accept-Ranges", "bytes");

    if (range) {
      const [startStr, endStr] = range.replace(/bytes=/, "").split("-");
      const start = parseInt(startStr ?? "0", 10);
      const end = endStr ? parseInt(endStr, 10) : fileSize - 1;
      res.setHeader("Content-Range", `bytes ${start}-${end}/${fileSize}`);
      res.setHeader("Content-Length", end - start + 1);
      res.status(206);
      fs.createReadStream(videoPath, { start, end }).pipe(res);
    } else {
      res.setHeader("Content-Length", fileSize);
      res.status(200);
      fs.createReadStream(videoPath).pipe(res);
    }
  },
);

export const deletePipeline = asyncHandler(
  async (req: Request, res: Response) => {
    const userId = res.locals.user.id;
    const id = req.params.id as string;
    await deletePipelineService(userId, id);
    res.status(200).json(new ApiResponse(true, "Pipeline deleted successfully", null));
  },
);

export const generateScript = asyncHandler(
  async (req: Request, res: Response) => {
    const { topic, model } = req.body;
    const userId = res.locals.user.id;
    const pipeline = await initPipelineService(userId, topic, model);
    await pipelineQueue.add("generate", {
      userId,
      pipelineId: pipeline.id,
      topic,
      model,
    });
    res
      .status(202)
      .json(
        new ApiResponse(true, "Pipeline queued successfully", {
          pipelineId: pipeline.id,
          model,
        }),
      );
  },
);
