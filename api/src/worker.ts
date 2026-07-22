import "dotenv/config";
import "./workers/pipeline.worker";
import "./workers/email.worker";
import "./workers/tiktok.worker";
import "./workers/analytics.worker";
import "./queue/pipeline.queue";
import "./queue/email.queue";
import "./queue/tiktok.queue";
import { setupAnalyticsScheduler } from "./queue/analytics.scheduler";

setupAnalyticsScheduler();

console.log("Workers running.");
