---
type: wayfinder:grilling
status: closed
assignee: claude
blocked-by: [04, 05]
blocks: [08]
---

## Question

How is the weekly BullMQ repeatable job structured — per-user jobs or one global job, and how does it fan out?

Decisions to make:
- **One global job** that queries all users with published reels and enqueues individual analytics jobs per reel — or **one repeatable job per user** created when they first publish?
- Cron expression: `0 9 * * 1` (Mondays 9am UTC)? Configurable?
- Which queue does the analytics feedback loop job land on — new `"analytics"` queue, or reuse `"pipeline"`?
- What happens if a user's TikTok token is expired when the job runs — skip silently, log, notify?
- Rate limiting: if 100 users each have 10 published reels, 1000 TikTok API calls fire at once — does BullMQ concurrency cap handle this or do we need explicit rate limiting?

## Context

The analytics agent and improver agent are triggered by this scheduler, not by user action. Agent contracts are blocked on tickets 04 and 05.

## Resolution

- **One global repeatable job** (`0 9 * * 1`, Mondays 9am UTC, hardcoded) that queries all users with published reels and enqueues one analytics job per user.
- **Separate `"analytics"` queue** — keeps analytics jobs isolated from user-facing pipeline jobs.
- **Worker concurrency: 3** on the analytics worker — naturally staggers TikTok API calls without a separate rate limiter.
- **Expired TikTok tokens**: skip silently with a log warning. Token refresh is handled elsewhere and is out of scope for the scheduler.
