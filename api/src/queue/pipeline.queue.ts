import { Queue } from "bullmq";
import { connection } from "../configs/redis.config";

export const pipelineQueue = new Queue("pipeline", { connection });
