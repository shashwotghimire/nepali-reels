import fs from "fs";
import path from "path";
import { Worker } from "bullmq";
import { connection } from "../configs/redis.config";
import { getUserTiktokAccessToken } from "../repositories/tiktok.repository";
import Reels from "../models/reels.model";
import Analytics from "../models/analytics.model";
import { analyticsAgent } from "../services/pipeline/agents/analytics.agent";
import { improverAgent } from "../services/pipeline/agents/improver.agent";
import type { TikTokVideoInsight } from "../models/analytics.model";
import { CLAUDE_MODELS } from "../constants/constant";

// TODO: replace with live TikTok video.list API call once ready
// const fetchTiktokInsights = async (accessToken: string, publishIds: string[]) => { ... }

const loadDummyInsights = (): TikTokVideoInsight[] => {
  const csv = fs.readFileSync(
    path.resolve(__dirname, "../../samples/tiktok-metrics.csv"),
    "utf-8",
  );
  return csv
    .trim()
    .split("\n")
    .slice(1)
    .map((line) => {
      const [video_id, create_time, , duration, view_count, like_count, comment_count, share_count] =
        line.split(",");
      return {
        video_id,
        create_time: Number(create_time),
        view_count: Number(view_count),
        like_count: Number(like_count),
        comment_count: Number(comment_count),
        share_count: Number(share_count),
        duration: Number(duration),
      };
    });
};

export const analyticsWorker = new Worker(
  "analytics",
  async (job) => {
    const { userId } = job.data as { userId: string };

    const connection = await getUserTiktokAccessToken(userId);
    if (!connection) {
      console.warn(`[analytics] no TikTok token for user ${userId}, skipping`);
      return;
    }

    const reels = await Reels.findAll({
      where: { userId, pipelineStatus: "published" },
      attributes: ["tiktokPublishId"],
    });

    if (reels.length === 0) {
      console.log(`[analytics] no published reels for user ${userId}, skipping`);
      return;
    }

    const rawData = loadDummyInsights();

    if (rawData.length === 0) {
      console.warn(`[analytics] TikTok returned no video data for user ${userId}`);
      return;
    }

    const model = CLAUDE_MODELS["Haiku 4.5"];
    const report = await analyticsAgent(rawData, model);
    const suggestions = await improverAgent(report, model);

    await Analytics.create({
      userId,
      rawData,
      report,
      suggestions,
      fetchedAt: new Date(),
    });

    console.log(`[analytics] completed for user ${userId}`);
  },
  { connection: connection, concurrency: 3 },
);

analyticsWorker.on("failed", (job, err) => {
  console.error(`[analytics] job ${job?.id} failed:`, err);
});
