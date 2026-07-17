import { Queue } from "bullmq";
import { connection } from "../configs/redis.config";

export const emailQueue = new Queue("email", { connection });
