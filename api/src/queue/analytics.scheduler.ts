import { enqueueAnalyticsJob, analyticsQueue } from "./analytics.queue";
import Reels from "../models/reels.model";

export const setupAnalyticsScheduler = async () => {
  const existing = await analyticsQueue.getRepeatableJobs();
  await Promise.all(existing.map((j) => analyticsQueue.removeRepeatableByKey(j.key)));

  await analyticsQueue.add(
    "weekly-analytics",
    {},
    { repeat: { pattern: "0 9 * * 1" }, removeOnComplete: true },
  );

  console.log("[analytics] scheduler registered — Mondays 9am UTC (0 9 * * 1)");
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

  const userIds = rows.map((r) => r.userId as string);
  console.log(`[analytics:fanout] enqueueing jobs for ${userIds.length} user(s): ${userIds.join(", ")}`);
  await Promise.all(userIds.map(enqueueAnalyticsJob));
  console.log(`[analytics:fanout] all jobs enqueued ✓`);
};
