---
type: wayfinder:grilling
status: open
blocked-by: [06, 07]
---

## Question

What is the full API and DB migration spec — every new route, every new Sequelize model field, and every migration file needed?

Decisions to make:
- `analytics_reports` Sequelize model definition (columns, indexes, associations)
- Migration file: `CREATE TABLE analytics_reports ...`
- New API routes:
  - `GET /api/analytics` — list reports for the user (paginated)?
  - `GET /api/analytics/:reelId` — reports for a specific reel?
  - `POST /api/analytics/run` — manual trigger endpoint?
- Auth: all analytics routes require session (same as pipeline routes)
- Repository functions needed: `createReport`, `findReportsByReel`, `findLatestReportForUser`

## Context

This is the final spec ticket — it depends on knowing the schema (02), agent outputs (04, 05), UI shape (06), and scheduler design (07). Once this is closed, implementation can begin.

## Resolution

<!-- answer recorded here on close -->
