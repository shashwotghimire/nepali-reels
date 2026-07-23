import { execFile } from "child_process";
import { promisify } from "util";
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
