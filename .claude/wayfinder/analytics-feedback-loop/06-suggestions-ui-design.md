---
type: wayfinder:prototype
status: open
blocked-by: [05]
blocks: [08]
---

## Question

What does the suggestions UI look like — where does it live, what does it show, and how does the user act on a suggestion?

Decisions to make:
- Location: new `/analytics` route, a section on `/dashboard`, or cards in `/library`?
- What's shown per suggestion: topic text, score/confidence, reasoning, the analytics chart for the reel that inspired it?
- CTA: can the user click a suggestion to pre-fill the "create reel" form with that topic?
- How are multiple weekly reports shown — latest only, or a history?

## Context

Suggestions come from the improver agent and are stored in `analytics_reports.suggestions`. They also get emailed (ticket 09). The frontend is React 19 + React Router 7 + Tailwind 4 + Shadcn/ui.

## Resolution

<!-- answer recorded here on close -->
