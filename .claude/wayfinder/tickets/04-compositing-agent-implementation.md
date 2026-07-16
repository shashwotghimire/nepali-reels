---
id: 4
label: wayfinder:prototype
status: open
blocked_by: [1, 2, 3]
assigned: false
---

## Question

Build the video compositing agent/step:
- Takes: video source path, SRT subtitle content, TTS audio path
- Does: trims/loops video to audio length, burns subtitles, muxes audio
- Outputs: single MP4 path
- Integrate into the pipeline service after the TTS step

Prototype with the subway surfer video to validate the approach works end-to-end.
