# SaaS phase checklist

- [x] Phase 1: plan, entitlements, usage ledger, cost estimates, budget policy, mocked tests and builds (approved in code review)
- [x] Phase 2: shared Explainer workflow, durable checkpoints and enforceable resource budgets (approved in independent code review)
- [x] Phase 3: Story and List workflows (implemented; awaiting user review)
- [x] Phase 4: paid creation features (implemented; awaiting user review)
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
- Timed scene overlays stay anchored to the assembled generated-video timeline. They are not rescaled when narration duration differs from planned scene duration; the FFmpeg regression covers a 0.6-second visual timeline with 0.9-second narration and checks both the intended visible window and the later absent window.
- Fictional Story narration must contain its approved `disclosureNp` verbatim. Video-spec validation cross-checks that same approved disclosure against the TTS `voiceoverText`, so a fictional disclosure cannot remain only in metadata.

Phase 4 adds a durable approval pause to Explainer, Story and List before video-spec/media work. Manual edits and AI revisions use optimistic script versions; AI revision requests reserve their entitlement atomically and use an idempotency key so concurrent/replayed requests cannot consume two revisions. Superseding a script clears approval and downstream checkpoints/artifacts, while completed reels are immutable. Fictional Story disclosure and List structure validations are re-run after every edit/revision.

Creation access is resolved server-side. `PHASE4_TEST_ENTITLEMENTS` is an explicit non-production-only user-to-plan injection boundary until Phase 5 billing exists; production and unlisted users retain the documented `legacy_compatibility` path and are not assigned a trial or paid plan. Trial gets the default voice/caption and no thumbnail, Creator gets the approved voice/caption/overlay/style and single-thumbnail features, and Plus gets three saved styles plus two metered thumbnail regenerations with selectable versions.

Saved style limits are enforced while holding authoritative user ownership, logo uploads are stored in S3, and a style snapshot is persisted on the reel. Caption presets and channel name/logo overlays are rasterized and passed into FFmpeg composition, rather than being UI-only metadata. Thumbnail generations use versioned S3 keys and durable selection metadata.

Provider-backed revisions and thumbnail regenerations use durable `reserved → submitted → provider_succeeded → applied/completed` records with expiring ownership. Live submitted replays are non-mutating, and only expired work that never crossed `submitted` is reclaimed automatically. A submitted request without a durable result is surfaced as uncertain and never blindly reissued; explicit acknowledgement unblocks the reel while retaining its consumed entitlement. The browser retains request identity across retry/reload, while the reel response exposes resumable expired reservations and saved provider results. Revision identity is bound to script version and instruction, and one active revision per version prevents duplicate provider spend. Thumbnail versions come from a monotonic reel counter, so failures and reverse completion cannot reuse an asset key.

Selecting a thumbnail version updates the reel's selected thumbnail metadata and gallery/cover URL. It does not re-render the completed MP4 and does not configure a TikTok cover; the current TikTok integration uploads the rendered MP4 only.

Phase 4 verification uses mocked/no-provider tests, local Skia/FFmpeg fixtures, and disposable PostgreSQL 16 only. No live provider generation, shared database migration, publication, deployment, or billing work was performed. Apply all September migrations in timestamp order, ending with `20260916000002-phase4-creation-features.js`, to a disposable/staging database before deployment. The corrected foreign key targets Better Auth's `user` table. PostgreSQL enum alteration is a separate idempotent statement; the remaining conditional schema block is transactional and was tested after a simulated partial attempt and a second rerun.
