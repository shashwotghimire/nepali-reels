---
type: wayfinder:map
---

## Destination

A weekly feedback loop: a cron-triggered analytics agent pulls per-video TikTok metrics, generates a report, then an improver agent reads it and surfaces topic suggestions to the user via UI and email. The destination is a fully specced, ready-to-implement design — schema, agent contracts, API surface, and frontend shape locked down.

## Notes

- Stack: Node 22 / Express 5 / BullMQ on Redis / Sequelize + Postgres / Claude on AWS Bedrock / React 19 frontend
- TikTok sandbox → use a dummy CSV in the same format as the real `video.insights` endpoint
- Storage: new `analytics_reports` table (not TimescaleDB — weekly cadence fits plain Postgres fine)
- Scheduler: BullMQ repeatable job (cron) — no new cron lib needed
- Suggestions surface in both UI and email (existing email queue)
- Skills to consult: /grilling, /domain-modeling

## Decisions so far

- [TikTok analytics data shape](01-tiktok-analytics-data-shape.md) — Use `POST /v2/video/query/` (Content Posting API, `video.list` scope), not Research API. Returns `view_count, like_count, comment_count, share_count, duration` for own videos. `favorites_count` not available; engagement rate = `(likes+comments+shares)/views`.
- [analytics_reports schema](02-analytics-reports-schema.md) — Table exists with all columns: rawData (JSONB/TikTokVideoInsight), engagementRate (FLOAT), report (JSONB), suggestions (JSONB). One row per reel per weekly run.
- [Add report + suggestions columns migration](10-migration-add-report-suggestions.md) — Migration and Sequelize model both in place. TikTokVideoInsight interface defined on the model.
- [Report format & charts](03-report-format-charts.md) — No charts stored. `report` JSONB holds flat numbers only: view_count, like_count, comment_count, share_count, favorites_count, engagement_rate. Frontend builds its own visualizations.
- [Analytics agent contract](04-analytics-agent-contract.md) — All reels for a user in one call. `analytics_reports` repurposed as user-level (userId FK, rawData as array). Agent uses Sonnet, single-call structured output. `report` shape: summary string + per-reel metrics array + top_performer_id + avg_engagement_rate.
- [analytics_reports schema migration (user-level)](11-analytics-reports-schema-migration.md) — Migration and model already in place with correct user-level schema. `user` table name confirmed (better-auth convention).
- [Improver agent contract](05-improver-agent-contract.md) — Cross-reel single call, Sonnet, 2–3 suggestions `{ topic, reasoning, score: 1–10 }`. Top scorer feeds back into the pipeline.
- [Scheduler design](07-scheduler-design.md) — One global BullMQ repeatable job (`0 9 * * 1`), separate `"analytics"` queue, worker concurrency 3. Skip expired TikTok tokens silently.

## Tickets

| # | File | Type | Status | Blocked by |
|---|---|---|---|---|
| 01 | [TikTok analytics data shape](01-tiktok-analytics-data-shape.md) | research | **closed** | — |
| 02 | [analytics_reports schema](02-analytics-reports-schema.md) | grilling | **closed** | 01 |
| 03 | [Report format & charts](03-report-format-charts.md) | grilling | **closed** | 01 |
| 04 | [Analytics agent contract](04-analytics-agent-contract.md) | grilling | **closed** | 02 |
| 05 | [Improver agent contract](05-improver-agent-contract.md) | grilling | **closed** | 02, 03 |
| 06 | [Suggestions UI design](06-suggestions-ui-design.md) | prototype | open | 05 |
| 07 | [Scheduler design](07-scheduler-design.md) | grilling | **closed** | 04, 05 |
| 08 | [API & DB migration spec](08-api-and-db-migration-spec.md) | grilling | open | 06, 07 |
| 09 | [Email digest design](09-email-digest-design.md) | grilling | open | 05 |
| 10 | [Add report + suggestions columns migration](10-migration-add-report-suggestions.md) | task | **closed** | — |
| 11 | [analytics_reports schema migration (user-level)](11-analytics-reports-schema-migration.md) | task | **closed** | 04 |

**Frontier** (unblocked, open): **06 — Suggestions UI design**, **09 — Email digest design**. **08 — API & DB migration spec** is now unblocked once 06 closes.

## Not yet specified

- Which Claude model and prompt shape for the analytics agent and improver agent
- How suggestions are stored and displayed in the UI (new route? dashboard section?)
- BullMQ repeat schedule expression and per-user vs global job design
- Rate-limit strategy at cron time if many users have published reels simultaneously

## Out of scope

<!-- nothing ruled out yet -->
