import { Worker } from "bullmq";
import { dispatchPipelineService, markPipelineAsFailedService } from "../services/pipeline/pipeline.service";
import { connection } from "../configs/redis.config";
import { toUserFriendlyError } from "../utils/error-messages.js";
import { shouldMarkPipelineFailed } from "../services/pipeline/workflow-dispatcher.service";
import { createWorkflowLeaseOwner } from "../services/pipeline/workflow-checkpoint.service";

interface PipelineJobData {
  userId: string;
  pipelineId: string;
  autoPublish?: boolean;
}

export async function processPipelineJob(job: {
  id?: string | number;
  attemptsMade: number;
  data: PipelineJobData;
}) {
  const { userId, pipelineId, autoPublish } = job.data;
  const executionKey = String(job.id ?? `${pipelineId}:${job.attemptsMade}`);
  const leaseOwner = createWorkflowLeaseOwner(executionKey);
  try {
    await dispatchPipelineService(userId, pipelineId, executionKey, !!autoPublish, leaseOwner);
  } catch (error) {
    if (shouldMarkPipelineFailed(error)) {
      try {
        await markPipelineAsFailedService(
          pipelineId,
          toUserFriendlyError(error),
          userId,
          { executionKey, leaseOwner },
        );
      } catch (failureUpdateError) {
        console.error(`[worker] could not persist pipeline failure for ${pipelineId}:`, failureUpdateError);
      }
    }
    throw error;
  }
}

export const pipelineWorker = new Worker(
  "pipeline",
  processPipelineJob,
  {
    connection,
    lockDuration: 25 * 60 * 1000, // 25 min — pipeline can take ~15 min in prod
  },
);

pipelineWorker.on("completed", (job) => console.log(`[worker] job ${job.id} completed`));
pipelineWorker.on("failed", async (job, err) => {
  console.error(`[worker] job ${job?.id} failed:`, err);
});
