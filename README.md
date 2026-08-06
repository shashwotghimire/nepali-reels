# nepali-reels

AI pipeline that turns a topic into a published Nepali short-form video on TikTok.

---

## Architecture

```
User (web)
    │
    │  POST /api/pipeline/generate-script
    ▼
┌─────────────┐        ┌───────────────────────────────────────────────────────┐
│  API Server │──────▶ │                   BullMQ (Redis)                      │
│  Express 5  │  202   │                                                       │
└─────────────┘        │  ┌─────────────────────────────────────────────────┐  │
                        │  │               Pipeline Worker                   │  │
                        │  │                                                 │  │
                        │  │  1. ScriptWriter    Claude + Tavily search      │  │
                        │  │  2. FactChecker     Claude + Tavily (auto-fix)  │  │
                        │  │  3. LinguisticExpert Claude (Nepali review)     │  │
                        │  │  4. VideoSpec       Claude → scene breakdown    │  │
                        │  │  5. TTS             Gemini 2.5 → WAV            │  │
                        │  │  6. Alignment       ElevenLabs → word timestamps│  │
                        │  │  7. VideoGen        OpenRouter → scene MP4s     │  │
                        │  │  8. Thumbnail       OpenRouter image gen        │  │
                        │  │  9. Composite       skia-canvas + FFmpeg        │  │
                        │  │ 10. S3 Upload       video + thumbnail           │  │
                        │  │ 11. Email           reel-ready notification     │  │
                        │  │ 12. TikTok Publish  PULL_FROM_URL → poll        │  │
                        │  └─────────────────────────────────────────────────┘  │
                        │                                                       │
                        │  ┌──────────────┐  ┌────────────┐  ┌──────────────┐  │
                        │  │ TikTok Worker│  │Email Worker│  │Analytics     │  │
                        │  │ (poll status)│  │(Resend SMTP│  │Worker (cron) │  │
                        │  └──────────────┘  └────────────┘  └──────────────┘  │
                        └───────────────────────────────────────────────────────┘
                                           │
                              ┌────────────┴─────────────┐
                              │                          │
                        ┌─────▼──────┐           ┌──────▼──────┐
                        │ PostgreSQL │           │  AWS S3 +   │
                        │  (Neon)    │           │ CloudFront  │
                        └────────────┘           └─────────────┘
```

---

## Stack

| Layer | Tech |
|---|---|
| Backend | Node 22, Express 5, TypeScript |
| Database | PostgreSQL (Neon) via Sequelize 6 |
| Jobs | BullMQ 5 + Redis |
| LLM | Claude via AWS Bedrock |
| TTS | `gemini-3.1-flash-tts-preview` (voice: Aoede) |
| Video alignment | ElevenLabs forced alignment |
| AI video gen | OpenRouter (Seedance 1.5 Pro / Wan 2.6 / Grok) |
| Media | FFmpeg + skia-canvas (Devanagari subtitle rendering) |
| Storage | AWS S3 + CloudFront |
| Auth | better-auth (Google OAuth) |
| Frontend | React 19, Vite 8, shadcn/ui, TanStack Query 5 |
| Deploy | Docker Compose → VPS via GitHub Actions |

---

## Services

Three Docker containers:

- **api** — HTTP server on port 8000
- **worker** — BullMQ workers (pipeline, tiktok, analytics, email) + weekly cron
- **web** — nginx serving the React SPA

---

## Pipeline Stages

Each stage saves its output as JSONB on the `reels` row. A failed pipeline can be retried — it resumes from the last saved checkpoint.

```
queued → script_generated → script_finalised → linguistic_reviewed
       → video_spec_generated → sound_generated → video_generated
       → publish_pending → published   (or → failed at any stage)
```

Subtitle rendering uses skia-canvas instead of FFmpeg's `drawtext` for correct Devanagari glyph shaping. Caption timings are proportionally scaled from ElevenLabs word timestamps to match actual TTS audio duration.

---

## Analytics

Weekly cron (Monday 9am UTC) runs a per-user Claude analysis of TikTok metrics, producing an engagement report and a list of suggested topics for the next week.

---

## Dev Setup

```bash
cp api/.env.example api/.env   # fill in credentials
docker compose up
```

API: `http://localhost:8000`  
Web: `http://localhost:5173`
