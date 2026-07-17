import "dotenv/config";
import "./workers/pipeline.worker";
import "./queue/pipeline.queue";

console.log("Workers running.");
