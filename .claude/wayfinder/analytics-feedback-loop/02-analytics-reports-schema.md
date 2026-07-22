---
type: wayfinder:grilling
status: closed
blocked-by: [01]
blocks: [04, 05]
---

## Question

What is the exact schema for the `analytics_reports` table and the shape of the `report` and `suggestions` JSONB columns?

Decisions to make:
- Columns on `analytics_reports`: id, reel_id (FK), created_at, raw_data (JSONB — the parsed CSV), report (JSONB — structured output from analytics agent), suggestions (JSONB — output from improver agent)
- What does `report` contain? Narrative text, numeric summaries, chart data (for frontend rendering)?
- What does `suggestions` contain? Array of topic strings? Scored/ranked objects with reasoning?
- Does a report belong to one reel or one user (covering all their published reels at that point in time)?

## Context

The analytics agent reads raw TikTok metrics and produces a `report`. The improver agent reads the report and produces `suggestions`. Both outputs are stored per-run, per-reel. Weekly cron appends a new row each run.

Blocked on ticket 01 (TikTok data shape) so we know what goes into `raw_data`.

## Resolution

Table `analytics_reports` exists (migration `20260722000000-analytics-reports.js`). Current columns: `id` (UUID PK), `reelId` (FK → reels, CASCADE), `tiktokVideoId` (STRING), `rawData` (JSONB), `engagementRate` (FLOAT), `fetchedAt` (DATE), `createdAt`, `updatedAt`.

Two columns need to be added in a follow-up migration:
- `report` (JSONB, nullable) — structured output from the analytics agent
- `suggestions` (JSONB, nullable) — array output from the improver agent

One row per reel per weekly run. All agent outputs co-located with the raw data on the same row.

`rawData` shape is the flat TikTok Research API video object (see ticket 01 resolution for full field list). `engagementRate` is computed pre-insert as `(like_count + comment_count + share_count + favorites_count) / view_count`.
