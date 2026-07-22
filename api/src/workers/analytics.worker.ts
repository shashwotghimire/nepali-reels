import fs from "fs";
import path from "path";
import { Worker } from "bullmq";
import { connection } from "../configs/redis.config";
import { runAnalyticsFanout } from "../queue/analytics.scheduler";
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
      const [video_id, create_time, video_description, duration, view_count, like_count, comment_count, share_count] =
        line.split(",");
      return {
        video_id: video_id!,
        video_description: video_description ?? "",
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
    console.log(`[analytics:worker] picked up job "${job.name}" (id=${job.id})`);

    if (job.name === "weekly-analytics") {
      console.log("[analytics:worker] triggering fanout...");
      await runAnalyticsFanout();
      console.log("[analytics:worker] fanout complete");
      return;
    }

    const { userId } = job.data as { userId: string };
    console.log(`[analytics:worker] processing user ${userId}`);

    const connection = await getUserTiktokAccessToken(userId);
    if (!connection) {
      console.warn(`[analytics:worker] no TikTok token for user ${userId} — skipping`);
      return;
    }
    console.log(`[analytics:worker] TikTok token found for user ${userId}`);

    const reels = await Reels.findAll({
      where: { userId, pipelineStatus: "published" },
      attributes: ["tiktokPublishId"],
    });

    if (reels.length === 0) {
      console.log(`[analytics:worker] no published reels for user ${userId} — skipping`);
      return;
    }
    console.log(`[analytics:worker] found ${reels.length} published reel(s) for user ${userId}`);

    const rawData = loadDummyInsights();
    console.log(`[analytics:worker] loaded ${rawData.length} dummy insights from CSV`);

    if (rawData.length === 0) {
      console.warn(`[analytics:worker] no video data for user ${userId} — skipping`);
      return;
    }

    const model = CLAUDE_MODELS["Sonnet 4.5"];
    console.log(`[analytics:worker] running analyticsAgent (model=${model})`);
    const report = await analyticsAgent(rawData, model);
    console.log(`[analytics:worker] analyticsAgent done — top performer: ${report.top_performer_id}, avg engagement: ${report.avg_engagement_rate}`);

    console.log("[analytics:worker] running improverAgent...");
    const suggestions = await improverAgent(report, model);
    console.log(`[analytics:worker] improverAgent done — ${suggestions.suggestedTopics.length} suggested topic(s)`);

    await Analytics.create({
      userId,
      rawData,
      report,
      suggestions,
      fetchedAt: new Date(),
    });

    console.log(`[analytics:worker] saved analytics record for user ${userId} ✓`);
  },
  { connection: connection, concurrency: 3 },
);

analyticsWorker.on("active", (job) => {
  console.log(`[analytics:worker] job active — "${job.name}" (id=${job.id})`);
});

analyticsWorker.on("completed", (job) => {
  console.log(`[analytics:worker] job completed — "${job.name}" (id=${job.id})`);
});

analyticsWorker.on("failed", (job, err) => {
  console.error(`[analytics:worker] job failed — "${job?.name}" (id=${job?.id}):`, err.message);
});
