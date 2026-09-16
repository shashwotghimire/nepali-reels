# SaaS phase checklist

- [x] Phase 1: plan, entitlements, usage ledger, cost estimates, budget policy, mocked tests and builds (approved in code review)
- [x] Phase 2: shared Explainer workflow, durable checkpoints and enforceable resource budgets (approved in independent code review)
- [x] Phase 3: Story and List workflows (implemented; awaiting user review)
- [ ] Phase 4: paid creation features
- [ ] Phase 5: subscriptions and allowances
- [ ] Phase 6: launch validation

Phase 1 and Phase 2 remain code-only. Their migrations have not been applied to a live database, and no paid provider generation or deployment was run. `costUsd` is a known estimated subtotal; `costEstimateIncomplete` flags missing prices, unknown usage, or pending usage.

Phase 2 now reserves aggregate provider calls, LLM tokens, searches, generated video seconds and AI revisions before provider work, including concurrent in-flight reservations. These are resource ceilings rather than a USD guarantee because provider prices and some returned usage can remain unknown. SDK-level provider retries are disabled so every retry is controlled and accounted for by the application.

Existing creation endpoints use an explicit `legacy_compatibility` entitlement: 75 delivered seconds, one thumbnail, and no commercial plan assignment. A future billing integration must implement `GenerationAccessRepository`, call `resolveGenerationEntitlement`, and pass that trusted server-side result into the workflow. Client-supplied plan claims are not accepted, and existing users are never silently assigned a trial.

Phase 2 review corrections:

- Notification jobs use BullMQ-safe deterministic IDs.
- Every video scene reserves budget before submission and stores its provider attempt, provider job ID, status, fingerprint, and durable clip artifact.
- Replays reconcile submitted work and reuse completed scenes; provider-reported failures stop after three attempts.
- Workflow stage claims lock the stable reel row before checking or inserting attempts.
- Legacy checkpoint adoption runs once, does not infer linguistic review from `finalScript`, migrates an existing WAV, and regenerates missing local audio under the normal budget.
- Trusted duration policy controls prompts, script and scene validation, thumbnail inclusion, container validation, and delivered duration: trial is 30 seconds without a thumbnail; paid and legacy compatibility use 74 seconds of content plus the 1-second thumbnail.
- FFmpeg normalization, concatenation, caption compositing, and thumbnail insertion render to unique temporary files with non-interactive overwrite flags and atomically replace completed outputs, so completed and interrupted local files are safe to replay.
- Retry status recovery recognizes a durable uploaded video (and an existing TikTok publish ID), restoring `video_generated` or `publish_pending` while the dispatcher reuses successful upload checkpoints.
- Each worker incarnation receives a unique stage lease owner, renews long-running stages, revokes expired owners during takeover, and fences stale checkpoint, artifact, and scene-provider work. Workflow contention does not mark the active execution failed.
- Pipeline failure transitions carry the exact execution and lease owner into a reel-row-locked repository check, so a revoked worker cannot mark the reel failed while its successor is running or after it succeeds.
- Non-video provider calls and retries recheck lease ownership immediately before invocation; reel result/status writes are transactionally fenced, and upload, notification, and publishing side effects require an active stage lease.

One provider boundary cannot be made fully automatic: after the durable `submitting` marker is written and before the returned provider job ID is persisted, a crash can leave the application unable to tell whether no request was sent or the provider accepted it. The workflow retains the reservation and pending usage record and blocks resubmission. An operator must reconcile that scene to avoid duplicate spend.

Phase 3 adds immutable version-1 Story and List/Countdown workflow definitions without changing Explainer version 1. Creation persists a discriminated `contentInput`: Story requires an explicit factual or fictional treatment; List requires an item count from 3–10 and ascending or descending order. Story generation validates recurring character/location continuity, story composition, sourced claims for factual treatments, and an explicit disclosure for fictional treatments. Fictional plot content does not enable search tools. List generation validates exact item counts, unique labels, consecutive visible numbering in the requested direction, ranking basis, and one composed scene per numbered item.

Story and List use dedicated script/review/video-spec prompts and stage orders, then share the budgeted and lease-fenced TTS, forced alignment, AI-video scene generation, thumbnail, FFmpeg render, durable artifact, upload, notification, and reel-level TikTok submission paths. Their resource ceilings and duration/thumbnail policy continue to come from trusted server-side generation access; Phase 3 does not implement billing or accept a client-supplied plan. Retry checkpoints, artifacts, failure transitions, and scene work use the persisted workflow version. Existing Explainer rows and legacy adoption remain version-1 compatible.

The frontend now sends the selected type-specific input, renders Story/List structures, shows reel-type badges, and displays persisted stage-level progress. Checked-in factual Story, fictional Story, and countdown fixtures cover valid output plus continuity, disclosure, numbering, timing, and ambiguous-input failures. The local visual-review fixture was inspected at a narrow responsive viewport. No live provider generation, live migration, deployment, or publication was run. The Phase 3 verification baseline is 81 passing backend tests plus successful API and web production builds; repository-wide web lint still reports eight pre-existing errors in shared UI/hooks outside the Phase 3 changes.

Phase 3 review corrections:

- Scene `onScreenText` is now a real timed composition input. List validation requires each item overlay to include its number, the shared renderer draws those number/label overlays separately from bottom narration captions, and an FFmpeg regression test verifies visible overlay pixels in the delivered frame.
- Fictional Story narration must contain its approved `disclosureNp` verbatim. Video-spec validation cross-checks that same approved disclosure against the TTS `voiceoverText`, so a fictional disclosure cannot remain only in metadata.
