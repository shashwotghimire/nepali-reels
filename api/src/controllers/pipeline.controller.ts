import path from "node:path";
import fs from "fs";
import { Request, Response } from "express";
import asyncHandler from "../utils/asyncHandler.util";
import { ApiResponse } from "../utils/ApiResponse.util";
import { pipelineQueue } from "../queue/pipeline.queue";
import { initPipelineService, retryPipelineService } from "../services/pipeline/pipeline.service";
import {
  getReelsService,
  getPipelineByIdService,
  deletePipelineService,
  resolvePipelineAudioPathService,
} from "../services/reels.service";
import { getS3PresignedUrl } from "../services/s3.service";
import { abandonUncertainScriptRevisionService, approveScriptService, editScriptService, getEntitlementsService, reviseScriptService } from "../services/pipeline/script-approval.service";
import { abandonUncertainThumbnailService, regenerateThumbnailService, selectThumbnailVersionService } from "../services/pipeline/thumbnail-version.service";

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

    const audioPath = await resolvePipelineAudioPathService(userId, id);
    if (!audioPath) {
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

export const retryPipeline = asyncHandler(
  async (req: Request, res: Response) => {
    const userId = res.locals.user.id;
    const pipelineId = req.params.id as string;

    const { resumeFrom } = await retryPipelineService(userId, pipelineId);

    await pipelineQueue.add("retry", {
      userId,
      pipelineId,
      resumeFrom,
    });

    res
      .status(202)
      .json(
        new ApiResponse(true, "Pipeline retry queued", { pipelineId, resumeFrom }),
      );
  },
);

export const generateScript = asyncHandler(
  async (req: Request, res: Response) => {
    const {
      topic, model, videoModel, autoPublish, ttsVoice,
      videoType = "explainer", storyInput, listInput,
      captionPreset = "default", styleId,
    } = req.body;
    const userId = res.locals.user.id;
    const contentInput = videoType === "story"
      ? { videoType, storyInput }
      : videoType === "list"
        ? { videoType, listInput }
        : { videoType: "explainer" as const };
    const pipeline = await initPipelineService(
      userId, topic, model, videoModel, ttsVoice, videoType, contentInput, captionPreset, styleId, !!autoPublish,
    );
    await pipelineQueue.add("generate", {
      userId,
      pipelineId: pipeline.id,
      topic,
      model,
      videoModel,
      autoPublish: !!autoPublish,
      ttsVoice,
    });
    res
      .status(202)
      .json(
        new ApiResponse(true, "Pipeline queued successfully", {
          pipelineId: pipeline.id,
          model: pipeline.claudeModel,
          videoModel: pipeline.videoModel,
          videoType: pipeline.videoType,
          workflowVersion: pipeline.workflowVersion,
        }),
      );
  },
);

export const getEntitlements = asyncHandler(async (_req: Request, res: Response) => {
  res.status(200).json(new ApiResponse(true, "Entitlements fetched", await getEntitlementsService(res.locals.user.id)));
});

export const editScript = asyncHandler(async (req: Request, res: Response) => {
  const result = await editScriptService(res.locals.user.id, req.params.id as string, req.body);
  res.status(200).json(new ApiResponse(true, "Script saved", result));
});

export const reviseScript = asyncHandler(async (req: Request, res: Response) => {
  const idempotencyKey = req.header("Idempotency-Key");
  if (!idempotencyKey) throw new Error("Idempotency-Key header is required");
  const result = await reviseScriptService(res.locals.user.id, req.params.id as string, { ...req.body, idempotencyKey });
  res.status(200).json(new ApiResponse(true, "Script revised", result));
});

export const approveScript = asyncHandler(async (req: Request, res: Response) => {
  const pipelineId = req.params.id as string;
  const result = await approveScriptService(res.locals.user.id, pipelineId, req.body.expectedVersion);
  await pipelineQueue.add("resume-after-approval", { userId: res.locals.user.id, pipelineId }, {
    jobId: `approval-${pipelineId}-v${result.scriptVersion}`,
  });
  res.status(202).json(new ApiResponse(true, "Script approved; production queued", result));
});

export const regenerateThumbnail = asyncHandler(async (req: Request, res: Response) => {
  const idempotencyKey = req.header("Idempotency-Key");
  if (!idempotencyKey) throw new Error("Idempotency-Key header is required");
  res.status(201).json(new ApiResponse(true, "Thumbnail generated", await regenerateThumbnailService(res.locals.user.id, req.params.id as string, idempotencyKey)));
});
export const selectThumbnail = asyncHandler(async (req: Request, res: Response) => {
  res.json(new ApiResponse(true, "Thumbnail selected", await selectThumbnailVersionService(res.locals.user.id, req.params.id as string, Number(req.params.version))));
});
export const abandonUncertainOperation = asyncHandler(async (req: Request, res: Response) => {
  const pipelineId = req.params.id as string; const key = req.params.key as string;
  if (req.params.kind === "script_revision") await abandonUncertainScriptRevisionService(res.locals.user.id, pipelineId, key);
  else if (req.params.kind === "thumbnail_regeneration") await abandonUncertainThumbnailService(res.locals.user.id, pipelineId, key);
  else throw new Error("Unsupported operation kind");
  res.json(new ApiResponse(true, "Uncertain operation acknowledged; its entitlement remains consumed", null));
});
