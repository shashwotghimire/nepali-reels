---
id: 4
label: wayfinder:prototype
status: closed
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

## Resolution

FFmpeg via `child_process.execFile`. Single-pass command: loops/trims source video to TTS audio length, burns SRT subtitles, muxes audio, outputs H.264+AAC MP4. Integrated into `pipeline.service.ts` after the TTS step. Validated end-to-end with the subway surfer placeholder.
