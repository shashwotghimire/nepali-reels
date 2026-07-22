---
type: wayfinder:grilling
status: open
blocked-by: [05]
---

## Question

What does the email digest look like — format, content, and how it's enqueued?

Decisions to make:
- Email content: list of suggestions with topic + reasoning? Include a summary of what performed well?
- Format: plain text vs HTML template (existing email queue uses what format?)
- Trigger: enqueued by the scheduler job after the improver agent finishes — or a separate step?
- Subject line and sender identity

## Context

The existing email queue (`"email"` BullMQ queue) already handles transactional emails. This digest reuses that infrastructure. Improver agent output (ticket 05) is the content source.

## Resolution

<!-- answer recorded here on close -->
