import { Queue } from "bullmq";
import { connection } from "../configs/redis.config";

export const analyticsQueue = new Queue("analytics", { connection });

export const enqueueAnalyticsJob = (userId: string) => {
  return analyticsQueue.add(
    "run-analytics",
    { userId },
    { removeOnComplete: true, removeOnFail: true },
  );
};
