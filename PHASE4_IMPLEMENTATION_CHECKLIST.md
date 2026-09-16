# Phase 4 implementation checklist

## States

- `awaiting_script_approval`: reviewed script exists; no video specification, media, thumbnail, render, upload, or publish work may run.
- `approved`: immutable approved-script fingerprint/version is recorded atomically, then the same workflow is resumed.
- `superseded`: a manual edit or AI revision increments the script version, clears approval, and invalidates only downstream checkpoints/artifacts.
- `completed`: existing completed reels remain readable and are never retroactively gated.

## API surface

- `GET /api/pipeline/entitlements` returns trusted server-resolved capabilities.
- `PATCH /api/pipeline/:id/script` persists a manual edit and supersedes downstream work.
- `POST /api/pipeline/:id/script/revise` performs one idempotent, bounded AI revision.
- `POST /api/pipeline/:id/script/approve` atomically approves the current version and queues resume.
- `GET|POST|PATCH|DELETE /api/pipeline/styles` manages entitlement-limited saved styles.
- `POST /api/pipeline/:id/thumbnails/regenerate` and `POST /api/pipeline/:id/thumbnails/:version/select` manage bounded versions.

## Schema

- Reel approval/version/revision counters, style snapshot, caption preset, selected thumbnail version.
- Saved channel styles owned by user with durable logo asset URL/key.
- Thumbnail versions with unique reel/version and selected state.
- Idempotent script revision request records.

## Entitlement cases

- Trial: Explainer only, default voice/caption, one AI revision, no thumbnails/styles/overlay.
- Creator: all types/voices/presets/overlay, two AI revisions, one style, one automatic thumbnail.
- Plus: Creator features, three styles, initial thumbnail plus two regenerations and selection.
- Legacy compatibility: explicit existing-user path; no commercial plan is inferred. New paid-only endpoints require a trusted test grant.
