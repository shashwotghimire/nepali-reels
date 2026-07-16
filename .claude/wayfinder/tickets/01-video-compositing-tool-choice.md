---
id: 1
label: wayfinder:research
status: closed
blocked_by: []
assigned: true
---

## Question

What FFmpeg commands / Node.js FFmpeg wrapper do we need for the compositing step? Specifically:
- Trimming or looping a source video to match a given audio duration
- Burning in SRT subtitles onto the video
- Muxing the TTS audio track onto the video (replacing original audio)
- Output as a single MP4

Research: fluent-ffmpeg vs raw ffmpeg spawn, subtitle filter options (ass vs srt), and whether we need any special codecs/flags for web-playable output.

## Resolution

**Raw `child_process.execFile` with FFmpeg** — no wrapper library.

- 2-3 fixed commands don't justify fluent-ffmpeg's abstraction
- Easier to debug (exact FFmpeg command visible)
- Commands stay the same when video source swaps to AI-generated

**FFmpeg strategy — single-pass command:**
```
ffmpeg -stream_loop -1 -i video.mp4 -i audio.wav -vf "subtitles=subs.srt" -c:a aac -map 0:v -map 1:a -shortest output.mp4
```
- `-stream_loop -1` loops video indefinitely, `-shortest` cuts at audio length
- `-vf "subtitles=subs.srt"` burns in SRT subtitles
- `-c:a aac` + H.264 (default) = web-playable MP4

**Output:** H.264 + AAC in MP4 container.
