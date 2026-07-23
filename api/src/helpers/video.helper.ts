import { execFile } from "child_process";
import { promisify } from "util";
import fs from "fs";
import { Caption } from "./srt.helper";
import { renderCaptionFrames, cleanupCaptionFrames } from "./subtitle-renderer";

const execFileAsync = promisify(execFile);

async function getAudioDuration(audioPath: string): Promise<number> {
  const { stdout } = await execFileAsync("ffprobe", [
    "-v", "error",
    "-show_entries", "format=duration",
    "-of", "default=noprint_wrappers=1:nokey=1",
    audioPath,
  ]);
  return parseFloat(stdout.trim());
}

function scaleCaptions(captions: Caption[], actualDuration: number): Caption[] {
  const specDuration = captions[captions.length - 1]!.endSec;
  const scale = actualDuration / specDuration;
  return captions.map((c) => ({
    text: c.text,
    startSec: c.startSec * scale,
    endSec: c.endSec * scale,
  }));
}

export async function burnThumbnailIntoVideo(
  videoPath: string,
  thumbnailBuffer: Buffer,
  pipelineId: string,
): Promise<string> {
  const thumbPath = `src/video/${pipelineId}-thumb.jpg`;
  const output = `src/video/${pipelineId}-with-thumb.mp4`;

  await fs.promises.writeFile(thumbPath, thumbnailBuffer);

  try {
    // input 0: thumbnail image (looped for 1s)
    // input 1: main video
    // input 2: 1s of silent audio to pair with the thumbnail segment
    // Probe the main video's audio sample rate and channel layout so concat streams match exactly
    const { stdout: probeOut } = await execFileAsync("ffprobe", [
      "-v", "error",
      "-select_streams", "a:0",
      "-show_entries", "stream=sample_rate,channel_layout",
      "-of", "default=noprint_wrappers=1",
      videoPath,
    ]);
    const srMatch = probeOut.match(/sample_rate=(\d+)/);
    const clMatch = probeOut.match(/channel_layout=(\S+)/);
    const sampleRate = srMatch ? srMatch[1] : "44100";
    const channelLayout = clMatch ? clMatch[1] : "stereo";

    await execFileAsync("ffmpeg", [
      "-loop", "1", "-t", "1", "-i", thumbPath,
      "-i", videoPath,
      "-f", "lavfi", "-t", "1", "-i", `anullsrc=channel_layout=${channelLayout}:sample_rate=${sampleRate}`,
      "-filter_complex",
        `[0:v]scale=1080:1920:force_original_aspect_ratio=increase,crop=1080:1920,fps=2997/100,setsar=1,format=yuv420p,setpts=PTS-STARTPTS[vt];` +
        `[1:v]setsar=1,format=yuv420p,setpts=PTS-STARTPTS[vm];` +
        `[vt][vm]concat=n=2:v=1:a=0[vout];` +
        `[2:a]aformat=sample_fmts=fltp:sample_rates=${sampleRate}:channel_layouts=${channelLayout},asetpts=PTS-STARTPTS[at];` +
        `[1:a]aformat=sample_fmts=fltp:sample_rates=${sampleRate}:channel_layouts=${channelLayout},asetpts=PTS-STARTPTS[am];` +
        `[at][am]concat=n=2:v=0:a=1[aout]`,
      "-map", "[vout]",
      "-map", "[aout]",
      "-c:v", "libx264", "-preset", "fast", "-crf", "23",
      "-c:a", "aac",
      output,
    ]);
  } finally {
    await fs.promises.unlink(thumbPath).catch(() => {});
  }

  return output;
}

export async function compositeVideo(pipelineId: string, captions: Caption[]): Promise<string> {
  const videoInput = "src/video/subwaysurfers.mp4";
  const audioInput = `src/audio/${pipelineId}.wav`;
  const output = `src/video/${pipelineId}-output.mp4`;
  const frameDir = "src/video";

  const duration = await getAudioDuration(audioInput);
  const scaled = scaleCaptions(captions, duration);
  const frames = await renderCaptionFrames(scaled, frameDir);

  // [0:v] scale+pad → [base]; then chain overlays: [base][2:v]overlay→[v1], [v1][3:v]overlay→[v2], ...
  // Input indices: 0=video, 1=audio, 2..N=caption PNGs
  let filterParts: string[] = [
    `[0:v]scale=1080:1920:force_original_aspect_ratio=decrease,pad=1080:1920:(ow-iw)/2:(oh-ih)/2[base]`,
  ];
  for (let i = 0; i < frames.length; i++) {
    const f = frames[i]!;
    const inLabel = i === 0 ? "[base]" : `[v${i}]`;
    const outLabel = i === frames.length - 1 ? "[vout]" : `[v${i + 1}]`;
    filterParts.push(
      `${inLabel}[${i + 2}:v]overlay=0:0:enable='between(t,${f.startSec.toFixed(3)},${f.endSec.toFixed(3)})'${outLabel}`,
    );
  }

  const filterComplex = filterParts.join(";");

  const inputArgs: string[] = [
    "-stream_loop", "-1", "-i", videoInput,
    "-i", audioInput,
  ];
  for (const f of frames) inputArgs.push("-i", f.pngPath);

  try {
    await execFileAsync("ffmpeg", [
      ...inputArgs,
      "-filter_complex", filterComplex,
      "-map", "[vout]",
      "-map", "1:a",
      "-c:v", "libx264",
      "-c:a", "aac",
      "-t", duration.toString(),
      output,
    ]);
  } finally {
    await cleanupCaptionFrames(frames);
  }

  return output;
}
