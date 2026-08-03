import { Worker } from "bullmq";
import { createPipelineService, markPipelineAsFailedService, resumePipelineService } from "../services/pipeline/pipeline.service";
import { connection } from "../configs/redis.config";
import { toUserFriendlyError } from "../utils/error-messages.js";

export const pipelineWorker = new Worker(
  "pipeline",
  async (job) => {
    const { userId, pipelineId, topic, model, videoModel, resumeFrom } = job.data;
    if (resumeFrom) {
      await resumePipelineService(userId, pipelineId, resumeFrom);
    } else {
      await createPipelineService(userId, pipelineId, topic, model, videoModel);
    }
  },
  {
    connection,
  },
);

pipelineWorker.on("completed", (job) => console.log(`[worker] job ${job.id} completed`));
pipelineWorker.on("failed", async (job, err) => {
  console.error(`[worker] job ${job?.id} failed:`, err);
  if (job?.data?.pipelineId) {
    await markPipelineAsFailedService(job.data.pipelineId, toUserFriendlyError(err));
  }
});
