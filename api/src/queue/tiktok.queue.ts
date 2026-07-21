import { Queue } from "bullmq";
import { connection } from "../configs/redis.config";

export const tiktokQueue = new Queue("tiktok", { connection });

export const enqueueTiktokStatusPoll = (
  publishId: string,
  pipelineId: string,
  userId: string,
) => {
  return tiktokQueue.add(
    "poll-status",
    { publishId, pipelineId, userId },
    {
      delay: 15_000,
      attempts: 20,
      backoff: { type: "fixed", delay: 15_000 },
      removeOnComplete: true,
      removeOnFail: true,
    },
  );
};
