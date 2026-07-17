import "dotenv/config";
import "./workers/pipeline.worker";
import "./workers/email.worker";
import "./queue/pipeline.queue";
import "./queue/email.queue";

console.log("Workers running.");
