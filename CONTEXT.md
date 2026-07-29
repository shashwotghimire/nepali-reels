# Project Context — nepali-reels

## What this repo is
Full-stack SaaS for automated Nepali-language short-form video creation and publishing.
User enters a topic → multi-agent pipeline generates script → TTS → AI video clips → composited MP4 → uploaded to S3 → published to TikTok. Weekly analytics cron pulls TikTok metrics, runs Claude analysis, and suggests improvement topics.

Internship capstone project. Comparison project: `/Users/shiva/Developer/nepali-shorts` (local pipeline tool, no auth/cloud).

## Architecture
```
web (React/Vite) → api (Express 5 + BullMQ) → workers → S3/TikTok
                                   ↓
                              PostgreSQL + Redis
```

- **api/**: Node.js + TypeScript. Controllers → Services → Repositories pattern.
- **web/**: React 19 + TanStack Query + shadcn/Tailwind.
- **Queue**: BullMQ backed by Redis. Long-running pipeline jobs enqueued, return 202 immediately.
- **Auth**: better-auth + Google OAuth. Per-user DB records.

## Pipeline stages (order matters)

1. **Script writer agent** — Claude (AWS Bedrock) + Tavily web search → Nepali narration, hook options, shot plan, captions, hashtags (`ScriptOutput` Zod schema)
2. **Fact checker agent** — Claude + Tavily → verdict: `pass` / `revise` / `needs_human` / `unsafe`. Auto-revises up to 2 times.
3. **Video spec agent** — Claude → `VideoSpec`: scenes with `startSec`, `endSec`, `bgPrompt`, `captionText`; voiceover text; thumbnail text
4. **TTS agent** — Google Gemini 2.5 TTS → `.wav` saved to `api/src/audio/<pipelineId>.wav`
5. **Forced alignment agent** — ElevenLabs → word-level timing → caption chunks
6. **AI video generator** — OpenRouter video API, 2 scenes at a time (batched), normalized via FFmpeg to 720×1280 H.264, concatenated to `bg-assembled.mp4`
7. **Thumbnail agent** — Claude generates image prompt → Pollinations.ai renders 720×1280 image
8. **Compositing** — skia-canvas renders captions as transparent PNGs → FFmpeg layers bg video + audio + caption PNGs → `<pipelineId>-output.mp4`
9. **Thumbnail burn** — FFmpeg prepends 1-second thumbnail as first frame
10. **S3 upload** — final MP4 → S3; local files cleaned up; `pipelineStatus → "video_generated"`
11. **TikTok publish** — user-triggered; TikTok API `PULL_FROM_URL`; BullMQ polls until `PUBLISH_COMPLETE`
12. **Weekly analytics** — Monday 9am UTC cron; per-user: TikTok metrics → Claude analysis → topic suggestions → saved to `analytics_reports`

## Pipeline status state machine
```
queued → processing → video_generated → publish_pending → published
                  ↘ failed
```

## Tech stack
| Layer | Tech |
|---|---|
| Backend runtime | Node.js + TypeScript (tsx), Express 5 |
| Database | PostgreSQL via Sequelize ORM |
| Auth | better-auth + Google OAuth |
| Queue | BullMQ + Redis (ioredis) |
| LLM | Claude via AWS Bedrock (`@anthropic-ai/bedrock-sdk`) |
| Claude models | Haiku 4.5, Sonnet 4.5, Opus 4.5/4.6 |
| TTS | Google Gemini 2.5 TTS (`gemini-3.1-flash-tts-preview`) |
| Forced alignment | ElevenLabs (word timestamps only — not used for TTS) |
| AI video | OpenRouter SDK |
| Media processing | FFmpeg + skia-canvas |
| Storage | AWS S3 + CloudFront |
| Email | Nodemailer via BullMQ |
| TikTok | TikTok Open API v2 |
| Frontend | React 19 + Vite + TanStack Query + shadcn |
| Deployment | Docker Compose (api + web + redis) |

## Database schema (key tables)
- **reels** — master pipeline record; `pipelineStatus` is the source of truth
- **analytics_reports** — Claude analysis output per user per week
- **tiktok_connections** — per-user TikTok OAuth tokens + profile
- **users/sessions** — managed by better-auth

## Key source files
- `api/src/services/pipeline/pipeline.service.ts` — master orchestrator
- `api/src/services/pipeline/agents/` — all 9 agent files
- `api/src/helpers/video.helper.ts` — FFmpeg compositing
- `api/src/helpers/subtitle-renderer.ts` — skia-canvas caption PNGs
- `api/src/helpers/tts.helper.ts` — Gemini TTS
- `api/src/queue/` — BullMQ queue definitions + scheduler
- `api/src/workers/` — pipeline, email, tiktok, analytics workers
- `api/src/llm/*.prompt.md` — raw Claude prompt drafts
- `api/src/schema/` — Zod schemas for all LLM outputs
- `web/src/pages/PipelineDetail.tsx` — per-reel detail view
- `web/src/components/analytics/` — analytics dashboard components

## Known gaps / what to fix (as of 2026-07-28)

### Before presenting
1. **Write README** — project description, setup steps, architecture diagram, env var table. Currently just "nepali-reels".
2. **Add `llm_usage` table** — track model, step, input_tokens, output_tokens, cost_microcents, duration_ms per Claude call. Blind to operating costs right now.
3. **Fix generated file paths** — `api/src/audio/` and `api/src/video/` are inside the source tree. Add `PIPELINE_STORAGE_PATH` env var and move outputs there.

### Engineering maturity
4. **Add tests** — Zod schema validation tests + pipeline state transitions. No real APIs needed, just mock.
5. **TTS fallback** — if Gemini TTS fails, fall back to macOS `say` or a silent track so the job completes degraded rather than failing.
6. **Stagger analytics cron** — all users fire at Monday 9am UTC simultaneously. Add `delay: userIndex * 10_000` when enqueuing.

### Nice-to-have
7. **Publisher abstraction** — extract a `Publisher` interface (manual/youtube/instagram/tiktok) so adding platforms is one file. TikTok logic is currently mixed into services.
8. **Per-pipeline cost on UI** — surface total token cost on PipelineDetail page.

## Comparison with nepali-shorts (the reference/predecessor project)
nepali-shorts (`/Users/shiva/Developer/nepali-shorts`) is the local single-user version of this concept — no auth, SQLite, local TTS/video workers, manual publish packets. Key things it has that nepali-reels lacks:
- Tests (integration + unit)
- Token/cost tracking (`llm_usage` table)
- TTS + visual fallback chains
- LLM mock mode for offline testing
- Configurable output paths
- Human approval gates (3 explicit checkpoints)
- A real README

nepali-reels has the production SaaS layer on top (auth, Postgres, Redis, BullMQ, S3, TikTok OAuth, Docker) that nepali-shorts intentionally skips.
