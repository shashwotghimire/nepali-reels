import { Request, Response } from "express";
import asyncHandler from "../utils/asyncHandler.util";
import { findPipelineByPublishId } from "../repositories/reels.repository";

type TiktokWebhookEvent =
  | "post.publish.failed"
  | "post.publish.complete"
  | "post.publish.inbox_delivered"
  | "post.publish.publicly_available"
  | "post.publish.no_longer_publicaly_available";

interface TiktokWebhookPayload {
  event: TiktokWebhookEvent;
  publish_id: string;
  post_id?: string;
  publish_type?: string;
  reason?: string;
}

const RETRYABLE_FAIL_REASONS = new Set(["internal", "video_pull_failed", "photo_pull_failed"]);

export const tiktokWebhookVerify = asyncHandler(async (req: Request, res: Response) => {
  const challenge = req.query["challenge"];
  res.status(200).send(challenge);
});

export const tiktokWebhook = asyncHandler(async (req: Request, res: Response) => {
  const payload = req.body as TiktokWebhookPayload;
  const { event, publish_id, reason } = payload;

  // Acknowledge immediately — TikTok expects a 2xx quickly
  res.status(200).json({ message: "ok" });

  if (!publish_id) return;

  const pipeline = await findPipelineByPublishId(publish_id);
  if (!pipeline) return;

  switch (event) {
    case "post.publish.publicly_available":
    case "post.publish.complete":
      pipeline.pipelineStatus = "published";
      break;

    case "post.publish.failed":
      if (reason && !RETRYABLE_FAIL_REASONS.has(reason)) {
        pipeline.pipelineStatus = "failed";
      }
      break;

    case "post.publish.no_longer_publicaly_available":
    case "post.publish.inbox_delivered":
      // No status change needed
      break;
  }

  await pipeline.save();
});
