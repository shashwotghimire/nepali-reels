import "dotenv/config";
import "./workers/pipeline.worker";
import "./workers/email.worker";
import "./workers/tiktok.worker";
import "./queue/pipeline.queue";
import "./queue/email.queue";
import "./queue/tiktok.queue";

console.log("Workers running.");
