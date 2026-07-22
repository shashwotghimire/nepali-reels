---
type: wayfinder:grilling
status: closed
blocked-by: [02, 03]
blocks: [07]
---

## Question

What is the contract for the improver agent — its inputs, prompt shape, output schema, and model?

Decisions to make:
- Input: a single reel's report, or all reports for a user in one call (cross-reel analysis)?
- Output schema: Zod shape for `suggestions` JSONB — array of `{ topic: string, reasoning: string, score: number }`? Something else?
- How many suggestions per run? Fixed N or model-decides?
- Prompt: how does it frame "what performed well" vs "what to do next"?
- Model: Haiku vs Sonnet?

## Context

The improver agent reads the analytics report and suggests new video topics. Its output is stored in `analytics_reports.suggestions` and surfaces in both the UI and email digest.

## Resolution

### Input

All reels for a user in a single call — the full `report` object from `analytics_reports` (cross-reel structured report produced by the analytics agent).

### Output schema (`suggestions` JSONB)

```ts
Array<{
  topic: string;       // suggested video topic
  reasoning: string;   // why this topic, grounded in the report data
  score: number;       // 1–10 integer; higher = more recommended
}>
```

2–3 suggestions per run. Array ordered by `score` descending. The top-scored suggestion (highest `score`) is eligible to be auto-fed back into the pipeline as the next video topic.

### Model

Claude Sonnet (AWS Bedrock). Single-call structured output — no tool use needed.

### Prompt shape

System prompt: "You are a content strategist. Given a cross-reel TikTok analytics report, suggest 2–3 new video topics that are likely to perform well. Base your reasoning on which topics and formats showed the highest engagement."

User message: the `report` JSONB object as JSON.

Output: the `suggestions` schema above via structured output.
