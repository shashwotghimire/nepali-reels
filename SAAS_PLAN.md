# Nepali Reels SaaS implementation plan

Status: commercial plan approved by the user on 2026-09-14. Implement one phase at a time; stop after each phase for review.

## Locked launch offer

Audience: Nepali individual creators.

- Free trial: one 30-second Explainer sample per verified user, default voice/caption style, script editing and one AI script revision, no thumbnail.
- Creator: NPR 1,499/month, two standard videos per billing period, up to 75 seconds each; Explainer, Story, and List/Countdown; Nepali narration/captions; manual script editing before rendering; two AI script revisions per video; all supported voices; caption presets; channel logo/name overlay; one saved channel style; one automatic thumbnail per video; no thumbnail regeneration; email support.
- Creator Plus: NPR 3,499/month, four standard videos per billing period, up to 75 seconds each; all Creator creation features; three saved channel styles; initial thumbnail plus at most two thumbnail regenerations per video; priority email support.
- No additional pricing rows or implementations for watermark-free downloads, cover/posting-text bundles, caption-only corrections, batch topics, or saved series presets: user removed these from the proposed paid feature scope. Preserve existing functionality. Free-trial watermark behavior can be settled in the launch UX phase.
- Monthly allowances reset on renewal, no rollover. Cancel at period end.
- Technical failures restore reserved allowance, without duplicate charges.
- No unrestricted premium-model selection under a standard video allowance.
- Paid top-up SKU/pricing, payment provider, taxes, asset-retention policy, and upgrades/proration are unresolved. Do not use the earlier NPR 549 top-up suggestion as approved pricing.
- TikTok publishing is not a paid tier distinction and depends on a compliant, ready integration. Sample-data analytics must not be represented as live paid analytics.
- No annual plans, teams, tutorials, promotions, voice cloning, premium-generation upsells, batch production, or marketing claims about native HD at launch.

## Cost assumptions, not measured facts or guaranteed profit

Budget at maximum 75-second delivered duration:

- Up to 90 generated seconds for rounding/trimming at standard Seedance 1.5 Pro 480p/no-audio rate.
- Illustrative total LLM budget across all stages and included revisions: 60k input + 20k output tokens at Sonnet baseline rates.
- Account for search, TTS audio output, alignment, actual thumbnail model, variable render/storage/delivery, and failed attempts.
- Illustrative 25% retry/failure reserve and NPR 160/USD planning exchange rate.
- Rounded cost budgets: NPR 375/Creator video and NPR 425/Plus video (including all thumbnail regenerations).
- Assume 5% payment fees for planning only. Full-allowance monthly contribution before fixed costs, trials, acquisition, support, and taxes: about NPR 674 for Creator, NPR 1,624 for Plus.
- Need real metering and spend limits to validate assumptions; duration alone does not bound cost. Existing agents permit up to 15 calls each. Story and List must fit the budget before release.
- Existing costUsd tracking is incomplete; do not treat it as provider-billed truth.

## Phase 1 — Commercial configuration and cost accounting foundation

Deliver:

1. Persist this approved plan and a phase checklist.
2. Central typed plan/entitlement definitions (integer NPR minor units, counts, limits) and standard-generation configuration. No billing/paid access enforcement yet, no silent reassignment of existing users.
3. Durable per-provider attempt usage/cost records linked to user and pipeline: operation/stage, provider/model/configuration, attempt identity, status, tokens including cache/audio where available, generated duration/image usage, USD amount, currency, actual-vs-estimated provenance and rate version. Unknown prices remain explicitly unknown, never silently free.
4. Record paid usage as it becomes available, including failed/retried work; prevent duplicate ledger records. Separate usage metering from a future customer-credit ledger.
5. Correct current cost calculations: TTS output accounting, actual thumbnail model/configuration, all generated clip durations rather than final MP4 duration; preserve existing UI cost compatibility while distinguishing incomplete estimates.
6. A cost-budget policy foundation covering aggregate calls/tokens/searches/generated seconds and included revisions. Do not claim a hard spend guarantee without pre-call enforcement and accounting for in-flight requests. If enforcement changes generation behavior materially, document and defer it to Phase 2.
7. Meaningful mocked tests for pricing/entitlements, cost math, unknown usage, duplicate attempts, and failure-path accounting; build/type checks appropriate to modified packages. No paid API calls.

Acceptance: reviewed migrations and tests, no secrets/live DB changes, unchanged successful Explainer behavior apart from accurate bookkeeping. Report measured vs assumed costs and outstanding uncertainty. Stop; do not start Phase 2.

## Phase 2 — Shared workflow execution and reliable checkpoints

- Existing workflow becomes Explainer; migrate old records to that type.
- Persist videoType, workflow version, stage/attempt checkpoints and durable artifacts.
- One dispatcher and reusable stages; consolidate create and resume code.
- Enforce aggregate provider budgets, bounded retries, max delivered duration, and trial duration.
- Make scene reuse/retries idempotent; durable intermediate media accessible to API/workers.
- Preserve old records and retry compatibility; verify via mocked integration tests.
- Stop for review.

## Phase 3 — Distinct Story and List workflows

Implementation status: completed in code on 2026-09-16 and awaiting user review. No live provider spend, live migration, deployment, or publication was performed.

- Dedicated input/output schemas, prompts, stage orders, pacing, composition, and validations.
- Story continuity and factual/fictional treatment; List structured items/numbering.
- Reuse shared TTS/alignment/render/storage/publishing services.
- Add type selection and progress display; mocked fixtures and visual review.
- No live provider spend without a specifically authorized benchmark budget.
- Stop for review.

## Phase 4 — Paid creation features

Implementation status: completed in code on 2026-09-16 and awaiting user review. No live migration, provider spend, deployment, or publication was performed.

- Script approval pause, editing and bounded AI revisions; resume from approved version.
- Supported voices, caption presets, channel overlays and saved styles (1/3).
- Thumbnails disabled for trial, one per paid video, Plus two regenerations with selectable versions.
- Backend entitlement checks backed by test entitlements until billing is activated.
- Do not add removed features.
- Stop for review.

## Phase 5 — Subscription billing and allowances

- Choose merchant/payment provider with user input about business/payment setup.
- Verified webhook handling, integer money, idempotent subscription events.
- Atomic allowance reserve/settle/release, renewal/cancellation; concurrent-request tests.
- Billing/usage UI, free-trial verification and abuse controls.
- Decide unresolved tax, retention, top-up, and plan-change policies before dependent work.
- Stop for review.

## Phase 6 — Launch validation

- Real provider benchmarks only after approving a bounded spend; full 75-second output for each type and all included revisions/thumbnail regenerations.
- Confirm costs across successes/failures, evaluate output quality and correction needs.
- Operational monitoring/admin support, ownership tests, payment tests, media lifecycle and deployment checks.
- Pricing/onboarding reflect only implemented features; hide/demo-label sample analytics.
- Confirm TikTok integration requirements before promising public publishing.
- Deployment/publication remains a separate explicit action.

## Execution instructions

Use GPT-5.6 Sol with medium reasoning for this implementation task and subagents. Assign bounded independent subtasks with non-overlapping file ownership, while the lead integrates and verifies. Do not advance phases automatically. Work in an isolated worktree, preserve unrelated local edits, and do not deploy, publish, purchase, use paid generation, or migrate a live database.
