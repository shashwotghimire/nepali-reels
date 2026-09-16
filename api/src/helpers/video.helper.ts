import { execFile } from "child_process";
import { randomUUID } from "crypto";
import { promisify } from "util";
import fs from "fs";
import path from "path";
import type { Caption } from "../types/subtitle.types";
import { renderCaptionFrames, cleanupCaptionFrames } from "./subtitle-renderer";
import {
  AI_VIDEO_MAX_TOTAL_DURATION,
  VIDEO_W,
  VIDEO_H,
} from "../constants/constant";

const execFileAsync = promisify(execFile);

function temporarySiblingPath(filePath: string): string {
  const extension = path.extname(filePath);
  const basename = path.basename(filePath, extension);
  return path.join(
    path.dirname(filePath),
    `.${basename}.${process.pid}-${randomUUID()}.tmp${extension}`,
  );
}

async function replaceWithFfmpegOutput(
  outputPath: string,
  args: string[],
): Promise<void> {
  const temporaryPath = temporarySiblingPath(outputPath);
  try {
    await execFileAsync("ffmpeg", ["-nostdin", "-y", ...args, temporaryPath]);
    await fs.promises.rename(temporaryPath, outputPath);
  } finally {
    await fs.promises.unlink(temporaryPath).catch(() => {});
  }
}

export async function getVideoDuration(filePath: string): Promise<number> {
  const { stdout } = await execFileAsync("ffprobe", [
    "-v",
    "error",
    "-show_entries",
    "format=duration",
    "-of",
    "default=noprint_wrappers=1:nokey=1",
    filePath,
  ]);
  return parseFloat(stdout.trim());
}

async function getAudioDuration(audioPath: string): Promise<number> {
  const { stdout } = await execFileAsync("ffprobe", [
    "-v",
    "error",
    "-show_entries",
    "format=duration",
    "-of",
    "default=noprint_wrappers=1:nokey=1",
    audioPath,
  ]);
  return parseFloat(stdout.trim());
}

export async function validateFinalVideo(
  filePath: string,
  maximumDurationSeconds = AI_VIDEO_MAX_TOTAL_DURATION + 1,
): Promise<void> {
  const { stdout } = await execFileAsync("ffprobe", [
    "-v",
    "error",
    "-select_streams",
    "v:0",
    "-show_entries",
    "stream=codec_name,width,height,pix_fmt,r_frame_rate",
    "-show_entries",
    "format=duration",
    "-of",
    "default=noprint_wrappers=1",
    filePath,
  ]);

  const codecMatch = stdout.match(/codec_name=(\S+)/);
  const widthMatch = stdout.match(/width=(\d+)/);
  const heightMatch = stdout.match(/height=(\d+)/);
  const pixFmtMatch = stdout.match(/pix_fmt=(\S+)/);
  const fpsMatch = stdout.match(/r_frame_rate=(\d+)\/(\d+)/);
  const durationMatch = stdout.match(/duration=([\d.]+)/);

  const codec = codecMatch?.[1];
  const width = widthMatch ? parseInt(widthMatch[1]!) : 0;
  const height = heightMatch ? parseInt(heightMatch[1]!) : 0;
  const pixFmt = pixFmtMatch?.[1];
  const fps = fpsMatch ? parseInt(fpsMatch[1]!) / parseInt(fpsMatch[2]!) : 0;
  const duration = durationMatch ? parseFloat(durationMatch[1]!) : 0;

  const errors: string[] = [];
  if (codec !== "h264") errors.push(`codec=${codec} (expected h264)`);
  if (width !== VIDEO_W || height !== VIDEO_H)
    errors.push(
      `dimensions=${width}x${height} (expected ${VIDEO_W}x${VIDEO_H})`,
    );
  if (pixFmt !== "yuv420p") errors.push(`pix_fmt=${pixFmt} (expected yuv420p)`);
  if (Math.abs(fps - 30) > 0.1)
    errors.push(`fps=${fps.toFixed(2)} (expected 30)`);
  if (duration > maximumDurationSeconds) {
    errors.push(
      `duration=${duration.toFixed(2)}s (expected ≤${maximumDurationSeconds}s)`,
    );
  }

  if (errors.length > 0) {
    throw new Error(
      `[video] final video validation failed: ${errors.join(", ")}`,
    );
  }
}

function scaleCaptions(captions: Caption[], actualDuration: number): Caption[] {
  if (captions.length === 0) return [];
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
  const temporaryThumbPath = temporarySiblingPath(thumbPath);

  await fs.promises.writeFile(temporaryThumbPath, thumbnailBuffer, {
    flag: "wx",
  });

  try {
    // input 0: thumbnail image (looped for 1s)
    // input 1: main video
    // input 2: 1s of silent audio to pair with the thumbnail segment
    // Probe the main video's audio sample rate and channel layout so concat streams match exactly
    const { stdout: probeOut } = await execFileAsync("ffprobe", [
      "-v",
      "error",
      "-select_streams",
      "a:0",
      "-show_entries",
      "stream=sample_rate,channel_layout",
      "-of",
      "default=noprint_wrappers=1",
      videoPath,
    ]);
    const srMatch = probeOut.match(/sample_rate=(\d+)/);
    const clMatch = probeOut.match(/channel_layout=(\S+)/);
    const sampleRate = srMatch ? srMatch[1] : "44100";
    const channelLayout = clMatch ? clMatch[1] : "stereo";

    await replaceWithFfmpegOutput(output, [
      "-loop",
      "1",
      "-t",
      "1",
      "-i",
      temporaryThumbPath,
      "-i",
      videoPath,
      "-f",
      "lavfi",
      "-t",
      "1",
      "-i",
      `anullsrc=channel_layout=${channelLayout}:sample_rate=${sampleRate}`,
      "-filter_complex",
      `[0:v]scale=${VIDEO_W}:${VIDEO_H}:force_original_aspect_ratio=increase,crop=${VIDEO_W}:${VIDEO_H},fps=30,setsar=1,format=yuv420p,setpts=PTS-STARTPTS[vt];` +
        `[1:v]setsar=1,format=yuv420p,setpts=PTS-STARTPTS[vm];` +
        `[vt][vm]concat=n=2:v=1:a=0[vout];` +
        `[2:a]aformat=sample_fmts=fltp:sample_rates=${sampleRate}:channel_layouts=${channelLayout},asetpts=PTS-STARTPTS[at];` +
        `[1:a]aformat=sample_fmts=fltp:sample_rates=${sampleRate}:channel_layouts=${channelLayout},asetpts=PTS-STARTPTS[am];` +
        `[at][am]concat=n=2:v=0:a=1[aout]`,
      "-map",
      "[vout]",
      "-map",
      "[aout]",
      "-c:v",
      "libx264",
      "-preset",
      "ultrafast",
      "-crf",
      "23",
      "-pix_fmt",
      "yuv420p",
      "-r",
      "30",
      "-c:a",
      "aac",
      "-movflags",
      "+faststart",
    ]);
  } finally {
    await fs.promises.unlink(temporaryThumbPath).catch(() => {});
  }

  return output;
}

export async function compositeVideo(
  pipelineId: string,
  captions: Caption[],
  videoInputPath: string,
): Promise<string> {
  const audioInput = `src/audio/${pipelineId}.wav`;
  const output = `src/video/${pipelineId}-output.mp4`;
  const frameDir = `src/video/${pipelineId}`;
  const temporaryFrameDir = path.join(
    frameDir,
    `.captions.${process.pid}-${randomUUID()}`,
  );

  const duration = await getAudioDuration(audioInput);

  const scaled = scaleCaptions(captions, duration);
  await fs.promises.mkdir(temporaryFrameDir, { recursive: true });
  const frames = await renderCaptionFrames(scaled, temporaryFrameDir);

  // [0:v] scale+pad → [base]; then chain overlays: [base][2:v]overlay→[v1], [v1][3:v]overlay→[v2], ...
  // Input indices: 0=video, 1=audio, 2..N=caption PNGs
  let filterParts: string[] = [
    `[0:v]scale=${VIDEO_W}:${VIDEO_H}:force_original_aspect_ratio=decrease,pad=${VIDEO_W}:${VIDEO_H}:(ow-iw)/2:(oh-ih)/2[base]`,
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
    "-stream_loop",
    "-1",
    "-i",
    videoInputPath,
    "-i",
    audioInput,
  ];
  for (const f of frames) inputArgs.push("-i", f.pngPath);

  try {
    await replaceWithFfmpegOutput(output, [
      ...inputArgs,
      "-filter_complex",
      filterComplex,
      "-map",
      "[vout]",
      "-map",
      "1:a",
      "-c:v",
      "libx264",
      "-pix_fmt",
      "yuv420p",
      "-r",
      "30",
      "-c:a",
      "aac",
      "-movflags",
      "+faststart",
      "-t",
      duration.toString(),
    ]);
  } finally {
    await cleanupCaptionFrames(frames);
    await fs.promises.rm(temporaryFrameDir, { recursive: true, force: true });
  }

  return output;
}
