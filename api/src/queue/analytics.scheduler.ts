import { enqueueAnalyticsJob, analyticsQueue } from "./analytics.queue";
import Reels from "../models/reels.model";

export const setupAnalyticsScheduler = async () => {
  await analyticsQueue.add(
    "weekly-analytics",
    {},
    { repeat: { pattern: "0 9 * * 1" }, removeOnComplete: true },
  );

  console.log("[analytics] weekly scheduler registered (0 9 * * 1 UTC)");
};

export const runAnalyticsFanout = async () => {
  const rows = await Reels.findAll({
    where: { pipelineStatus: "published" },
    attributes: ["userId"],
    group: ["userId"],
  });

  if (rows.length === 0) {
    console.log("[analytics] fanout: no users with published reels");
    return;
  }

  await Promise.all(rows.map((r) => enqueueAnalyticsJob(r.userId as string)));
  console.log(`[analytics] fanout: enqueued jobs for ${rows.length} users`);
};
