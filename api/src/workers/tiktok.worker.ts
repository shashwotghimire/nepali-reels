import { Worker, UnrecoverableError } from "bullmq";
import { connection } from "../configs/redis.config";
import { getUserTiktokAccessToken } from "../repositories/tiktok.repository";
import { findPipelineByPublishId } from "../repositories/reels.repository";
import { workerLog } from "../helpers/worker-log.helper";

const NON_RETRYABLE_REASONS = new Set([
  "auth_removed",
  "spam_risk_user_banned_from_posting",
  "spam_risk_text",
  "spam_risk",
  "publish_cancelled",
]);

const log = (jobId: string | undefined, msg: string, extra?: unknown) =>
  workerLog("tiktok-worker", jobId, msg, extra);

export const tiktokWorker = new Worker(
  "tiktok",
  async (job) => {
    const { publishId, pipelineId, userId } = job.data;
    log(job.id, `starting — publishId=${publishId} pipelineId=${pipelineId} userId=${userId} attempt=${job.attemptsMade + 1}`);

    const connection_ = await getUserTiktokAccessToken(userId);
    if (!connection_) {
      log(job.id, "no TikTok connection found for user — unrecoverable");
      throw new UnrecoverableError("TikTok connection not found");
    }
    log(job.id, "fetching publish status from TikTok");

    const res = await fetch("https://open.tiktokapis.com/v2/post/publish/status/fetch/", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${connection_.tiktokAccessToken}`,
        "Content-Type": "application/json; charset=UTF-8",
      },
      body: JSON.stringify({ publish_id: publishId }),
    });

    const data = await res.json();
    log(job.id, "TikTok API response", data);

    if (data.error?.code !== "ok") {
      throw new Error(`TikTok status fetch error: ${data.error?.code} — ${data.error?.message}`);
    }

    const { status, fail_reason } = data.data;
    log(job.id, `publish status=${status}${fail_reason ? ` fail_reason=${fail_reason}` : ""}`);

    if (status === "PROCESSING_UPLOAD" || status === "PROCESSING_DOWNLOAD") {
      log(job.id, "still processing — will retry");
      throw new Error("Still processing — retry");
    }

    const pipeline = await findPipelineByPublishId(publishId);
    if (!pipeline) {
      log(job.id, "pipeline not found in DB — unrecoverable");
      throw new UnrecoverableError("Pipeline not found");
    }

    if (status === "PUBLISH_COMPLETE" || status === "SEND_TO_USER_INBOX") {
      log(job.id, `publish succeeded (status=${status}) — marking pipeline as published`);
      pipeline.pipelineStatus = "published";
      await pipeline.save();
      return;
    }

    if (status === "FAILED") {
      if (fail_reason && NON_RETRYABLE_REASONS.has(fail_reason)) {
        log(job.id, `non-retryable failure: ${fail_reason} — marking pipeline as failed`);
        pipeline.pipelineStatus = "failed";
        await pipeline.save();
        throw new UnrecoverableError(`TikTok publish failed: ${fail_reason}`);
      }
      log(job.id, `retryable failure: ${fail_reason}`);
      throw new Error(`TikTok publish failed (retryable): ${fail_reason}`);
    }

    log(job.id, `unexpected status: ${status}`);
  },
  { connection },
);

tiktokWorker.on("completed", (job) =>
  log(job.id, "job completed"),
);

tiktokWorker.on("failed", async (job, err) => {
  if (err instanceof UnrecoverableError) return;
  if (job && job.attemptsMade >= (job.opts.attempts ?? 20)) {
    log(job.id, `max attempts reached (${job.attemptsMade}) — marking pipeline as failed`);
    const pipeline = await findPipelineByPublishId(job.data.publishId);
    if (pipeline) {
      pipeline.pipelineStatus = "failed";
      await pipeline.save();
    }
  } else {
    log(job?.id, `job failed (attempt ${job?.attemptsMade ?? "?"}): ${err.message}`);
  }
});
