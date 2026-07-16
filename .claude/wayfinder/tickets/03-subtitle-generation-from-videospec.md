---
id: 3
label: wayfinder:grilling
status: closed
blocked_by: [1]
assigned: true
---

## Question

How do we generate SRT subtitle content from the video spec / final script?
- The video spec has scene segments with text — do we map each segment to a timed subtitle entry?
- Timing: derive from TTS audio duration (evenly split? or use TTS word timestamps if available?)
- Output format: `.srt` file written to disk before FFmpeg burns it in?

Decide on the subtitle generation approach and where it fits in the pipeline (before or inside the compositing agent).

## Resolution

**Map `videoSpec.scenes` directly to SRT format** — each scene's `startSec`/`endSec` + `captionText` becomes an SRT entry. One utility function, no LLM call.

**Proportional time scaling:** TTS audio length is ground truth. Scale all scene timestamps by `(actualTTSDuration / specTotalDuration)` so subtitles sync with actual audio.

- Write `.srt` file to disk before FFmpeg burns it in
- Lives as a helper/utility called inside the compositing step (not a separate pipeline agent)
