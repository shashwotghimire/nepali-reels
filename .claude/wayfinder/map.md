---
label: wayfinder:map
status: open
---

## Destination

A video compositing pipeline step that combines a source video + burnt-in subtitles (from video spec) + TTS audio into a single MP4, with the video source abstracted behind an interface so it's swappable for AI-generated video later. Then, move the entire pipeline to run in the background via BullMQ.

## Notes

- Domain: Nepali reels content automation pipeline
- The video source is currently a local subway surfer MP4 (placeholder); will be replaced by a video LLM API call in the future
- Subtitles are simple SRT-style (sentence blocks), not word-by-word animated
- Video length = TTS audio length (trim or loop source video to match)
- Pipeline currently runs synchronously in `createPipelineService`
- FFmpeg is the likely compositing tool

## Decisions so far

- [Video compositing tool choice](tickets/01-video-compositing-tool-choice.md) — Raw FFmpeg via child_process.execFile, single-pass command, H.264+AAC output
- [Video source abstraction](tickets/02-video-source-abstraction.md) — Simple function `getVideoSource(pipelineId): Promise<string>`, swap implementation when API key arrives
- [Subtitle generation from videospec](tickets/03-subtitle-generation-from-videospec.md) — Map scenes directly to SRT, proportionally scale timestamps to actual TTS audio duration

## Not yet specified

- How the frontend should poll/display pipeline progress once BullMQ is in place
- What the AI video generation interface looks like when an API key is available

## Out of scope

- Fancy word-by-word subtitle animations / highlighting
- AI video generation (no API key yet — just the abstraction point)
- Frontend redesign beyond pipeline status polling
