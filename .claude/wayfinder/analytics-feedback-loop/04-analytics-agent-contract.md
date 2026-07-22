---
type: wayfinder:grilling
status: closed
blocked-by: [02]
blocks: [07]
---

## Question

What is the contract for the analytics agent — its inputs, prompt shape, output schema, and which Claude model it uses?

Decisions to make:
- Input: raw_data from `analytics_reports` (parsed CSV metrics for one reel)? Or a batch across all a user's published reels?
- Output schema: Zod shape for the `report` JSONB — what fields are required vs optional?
- Prompt: what framing produces the most useful report? (narrative + structured numbers vs pure structured)
- Model: Haiku (fast/cheap) vs Sonnet (richer reasoning)?
- Tool use: does the analytics agent need any tools, or is it a single-call structured output?

## Context

The analytics agent is a new pipeline stage that runs outside the main video-creation pipeline — triggered by the weekly cron, not by the user. It reads TikTok metrics and writes a report. Its output feeds the improver agent (ticket 05).

## Resolution

### Input

All published reels for a user in a single call. The agent receives an array of `TikTokVideoInsight` objects — one per published reel — for the current week's metrics.

### Storage model change

`analytics_reports` is repurposed as user-level (not per-reel). **Schema diff from ticket 02:**
- Drop `reelId` FK
- Drop `tiktokVideoId`  
- Add `userId` FK → users (CASCADE)
- `rawData` becomes `JSONB[]` — array of all reel metric objects
- `engagementRate` dropped (cross-reel aggregate doesn't map to a single float; per-reel rates live inside `rawData`)
- `report` JSONB — cross-reel structured report
- `suggestions` JSONB — improver agent output

**Requires a new migration** to replace the existing `analytics_reports` table (see task ticket 11).

### Output schema (`report` JSONB)

```ts
{
  summary: string;               // 2-3 sentence cross-reel narrative
  reels: Array<{
    tiktokVideoId: string;
    view_count: number;
    like_count: number;
    comment_count: number;
    share_count: number;
    engagement_rate: number;     // (likes+comments+shares) / views — favorites_count not available from /v2/video/query/
  }>;
  top_performer_id: string;      // tiktokVideoId of the highest engagement_rate reel
  avg_engagement_rate: number;   // mean across all reels this run
}
```

### Model

Claude Sonnet (AWS Bedrock). Single-call structured output — no tool use needed.

### Prompt shape

System prompt: "You are an analytics assistant. Given a list of TikTok video metrics, produce a structured report. Be concise."

User message: the raw `rawData` array as JSON.

Output: the `report` schema above via structured output / tool call.
