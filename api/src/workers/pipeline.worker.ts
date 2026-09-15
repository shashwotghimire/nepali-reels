import { Worker } from "bullmq";
import { dispatchPipelineService, markPipelineAsFailedService } from "../services/pipeline/pipeline.service";
import { connection } from "../configs/redis.config";
import { toUserFriendlyError } from "../utils/error-messages.js";

export const pipelineWorker = new Worker(
  "pipeline",
  async (job) => {
    const { userId, pipelineId, autoPublish } = job.data;
    await dispatchPipelineService(
      userId,
      pipelineId,
      String(job.id ?? `${pipelineId}:${job.attemptsMade}`),
      !!autoPublish,
    );
  },
  {
    connection,
    lockDuration: 25 * 60 * 1000, // 25 min — pipeline can take ~15 min in prod
  },
);

pipelineWorker.on("completed", (job) => console.log(`[worker] job ${job.id} completed`));
pipelineWorker.on("failed", async (job, err) => {
  console.error(`[worker] job ${job?.id} failed:`, err);
  if (job?.data?.pipelineId) {
    await markPipelineAsFailedService(job.data.pipelineId, toUserFriendlyError(err), job.data.userId);
  }
});
