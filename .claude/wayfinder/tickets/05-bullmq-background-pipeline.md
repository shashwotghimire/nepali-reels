---
id: 5
label: wayfinder:grilling
status: open
blocked_by: [4]
assigned: false
---

## Question

How to move `createPipelineService` into a BullMQ background job:
- What queue/worker setup? Single queue with one job type, or separate queues per agent step?
- How does the API endpoint respond? Return pipeline ID immediately, frontend polls status?
- Redis connection config — local dev + production considerations
- Error handling: what happens when a step fails mid-pipeline?

Decide on the BullMQ architecture before implementing.
