import { execFile } from "child_process";
import { promisify } from "util";
import { writeFile } from "fs/promises";
import { Scene } from "../schema/video-spec.schema";
import { generateSrt } from "./srt.helper";

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

export async function compositeVideo(pipelineId: string, scenes: Scene[]): Promise<string> {
  const videoInput = "src/video/subwaysurfers.mp4";
  const audioInput = `src/audio/${pipelineId}.wav`;
  const srtPath = `src/video/${pipelineId}.srt`;
  const output = `src/video/${pipelineId}-output.mp4`;

  const duration = await getAudioDuration(audioInput);

  const srt = generateSrt(scenes, duration);
  await writeFile(srtPath, srt, "utf-8");

  await execFileAsync("ffmpeg", [
    "-stream_loop", "-1",
    "-i", videoInput,
    "-i", audioInput,
    "-map", "0:v",
    "-map", "1:a",
    "-c:v", "libx264",
    "-c:a", "aac",
    "-vf", `subtitles=${srtPath}`,
    "-t", duration.toString(),
    output,
  ]);

  return output;
}
