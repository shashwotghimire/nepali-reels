import { Worker } from "bullmq";
import { sendEmail } from "../services/email.service";
import { connection } from "../configs/redis.config";

export const emailWorker = new Worker(
  "email",
  async (job) => {
    const { to, subject, html } = job.data;
    await sendEmail(to, subject, html);
  },
  { connection },
);

emailWorker.on("completed", (job) => console.log(`[email-worker] job ${job.id} completed`));
emailWorker.on("failed", (job, err) => console.error(`[email-worker] job ${job?.id} failed:`, err));
