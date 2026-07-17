import { Worker } from "bullmq";
import { createPipelineService, markPipelineAsFailedService } from "../services/pipeline/pipeline.service";
import { connection } from "../configs/redis.config";

export const pipelineWorker = new Worker(
  "pipeline",
  async (job) => {
    const { userId, pipelineId, topic, model } = job.data;
    await createPipelineService(userId, pipelineId, topic, model);
  },
  {
    connection,
  },
);

pipelineWorker.on("completed", (job) => console.log(`[worker] job ${job.id} completed`));
pipelineWorker.on("failed", async (job, err) => {
  console.error(`[worker] job ${job?.id} failed:`, err);
  if (job?.data?.pipelineId) {
    await markPipelineAsFailedService(job.data.pipelineId);
  }
});
