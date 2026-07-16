---
id: 2
label: wayfinder:grilling
status: closed
blocked_by: [1]
assigned: true
---

## Question

How should the video source be abstracted so it's swappable? Options:
- A `VideoSource` interface/strategy pattern where one impl reads from local file and another calls an AI video API
- A simple function signature `getVideo(spec): Promise<FilePath>` that the compositing step calls
- Config-driven: env var picks the source provider

Decide on the shape of this abstraction — minimal for now, extensible for later.

## Resolution

**Simple function signature** — one function in one file, no interface/strategy/config pattern.

```ts
// video-source.ts
type GetVideoSource = (pipelineId: string) => Promise<string>; // returns file path
```

- Matches project style (simple async functions, not OOP)
- Only two cases ever: local file now, API call later — swap the implementation inside the function
- No env-var switching until both options need to coexist (likely never — just replace the placeholder)
