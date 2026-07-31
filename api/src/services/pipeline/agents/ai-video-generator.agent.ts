import { execFile } from "child_process";
import { promisify } from "util";
import fs from "fs";
import path from "path";
import { Scene } from "../../../schema/video-spec.schema";
import { openRouterClient } from "../../../configs/openrouter.config";
import {
  AI_VIDEO_POLL_INTERVAL_MS,
  AI_VIDEO_POLL_TIMEOUT_MS,
  AI_VIDEO_DURATION_TOLERANCE,
  type VideoModel,
} from "../../../constants/constant";

const execFileAsync = promisify(execFile);

function buildPrompt(bgPrompt: string): string {
  return `${bgPrompt}. Vertical 9:16 portrait composition for TikTok, 720x1280. Cinematic, coherent motion, high detail. No readable text, subtitles, captions, logos, interface elements, or watermark.`;
}

async function submitSceneJob(scene: Scene, model: string): Promise<string> {
  const duration = Math.round(scene.endSec - scene.startSec);

  console.log(
    `[ai-video] submitting job — duration=${duration}s prompt="${scene.bgPrompt}"`,
  );

  const result = await openRouterClient.videoGeneration.generate({
    videoGenerationRequest: {
      model,
      prompt: buildPrompt(scene.bgPrompt),
      duration,
      aspectRatio: "9:16",
      resolution: "480p",
      generateAudio: false,
    },
  });

  if (!result.id) {
    throw new Error(
      `[ai-video] job submission response missing id: ${JSON.stringify(result)}`,
    );
  }

  console.log(`[ai-video] job submitted — id=${result.id}`);
  return result.id;
}

async function pollJobUntilDone(jobId: string): Promise<string> {
  const deadline = Date.now() + AI_VIDEO_POLL_TIMEOUT_MS;

  while (Date.now() < deadline) {
    await new Promise((r) => setTimeout(r, AI_VIDEO_POLL_INTERVAL_MS));

    const result = await openRouterClient.videoGeneration.getGeneration({
      jobId,
    });

    console.log(`[ai-video] job ${jobId} status=${result.status}`);

    if (result.status === "completed") {
      const url = result.unsignedUrls?.[0];
      if (!url) {
        throw new Error(
          `[ai-video] job ${jobId} completed but unsigned_urls is empty: ${JSON.stringify(result)}`,
        );
      }
      return url;
    }

    if (result.status === "failed") {
      throw new Error(
        `[ai-video] job ${jobId} failed: ${(result as { error?: string }).error ?? "no error detail"}`,
      );
    }
  }

  throw new Error(
    `[ai-video] job ${jobId} timed out after ${AI_VIDEO_POLL_TIMEOUT_MS / 1000}s`,
  );
}

async function downloadClip(jobId: string, destPath: string): Promise<void> {
  const stream = await openRouterClient.videoGeneration.getVideoContent({
    jobId,
  });

  const writer = fs.createWriteStream(destPath);
  const reader = stream.getReader();

  await new Promise<void>((resolve, reject) => {
    writer.on("error", reject);
    writer.on("finish", resolve);

    const pump = async () => {
      try {
        while (true) {
          const { done, value } = await reader.read();
          if (done) {
            writer.end();
            break;
          }
          if (!writer.write(value)) {
            await new Promise((r) => writer.once("drain", r));
          }
        }
      } catch (err) {
        writer.destroy(err instanceof Error ? err : new Error(String(err)));
        reject(err);
      }
    };
    pump();
  });
}

async function validateClipWithFfprobe(filePath: string): Promise<void> {
  const { stdout } = await execFileAsync("ffprobe", [
    "-v",
    "error",
    "-select_streams",
    "v:0",
    "-show_entries",
    "stream=codec_type",
    "-of",
    "default=noprint_wrappers=1:nokey=1",
    filePath,
  ]);
  if (!stdout.trim().includes("video")) {
    throw new Error(
      `[ai-video] ffprobe validation failed — no video stream in ${filePath}`,
    );
  }
}

async function normalizeClip(
  inputPath: string,
  outputPath: string,
  sceneDurationSec: number,
): Promise<void> {
  const { stdout: audioCheck } = await execFileAsync("ffprobe", [
    "-v",
    "error",
    "-select_streams",
    "a:0",
    "-show_entries",
    "stream=codec_type",
    "-of",
    "default=noprint_wrappers=1:nokey=1",
    inputPath,
  ]).catch(() => ({ stdout: "" }));

  const hasAudio = audioCheck.trim().includes("audio");

  if (hasAudio) {
    await execFileAsync("ffmpeg", [
      "-i",
      inputPath,
      "-t",
      sceneDurationSec.toString(),
      "-vf",
      "scale=720:1280:force_original_aspect_ratio=increase,crop=720:1280,setsar=1,fps=30,format=yuv420p",
      "-map",
      "0:v",
      "-map",
      "0:a",
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
      outputPath,
    ]);
  } else {
    await execFileAsync("ffmpeg", [
      "-i",
      inputPath,
      "-f",
      "lavfi",
      "-i",
      "anullsrc=channel_layout=stereo:sample_rate=44100",
      "-t",
      sceneDurationSec.toString(),
      "-filter_complex",
      "[0:v]scale=720:1280:force_original_aspect_ratio=increase,crop=720:1280,setsar=1,fps=30,format=yuv420p[vout]",
      "-map",
      "[vout]",
      "-map",
      "1:a",
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
      outputPath,
    ]);
  }
}

async function concatenateClips(
  clipPaths: string[],
  pipelineDir: string,
  expectedTotalDuration: number,
): Promise<string> {
  const manifestPath = path.join(pipelineDir, "concat.txt");
  const outputPath = path.join(pipelineDir, "bg-assembled.mp4");

  const manifest = clipPaths.map((p) => `file '${path.resolve(p)}'`).join("\n");
  await fs.promises.writeFile(manifestPath, manifest, "utf8");

  try {
    await execFileAsync("ffmpeg", [
      "-f",
      "concat",
      "-safe",
      "0",
      "-i",
      manifestPath,
      "-c",
      "copy",
      outputPath,
    ]);
  } finally {
    await fs.promises.unlink(manifestPath).catch(() => {});
  }

  const { stdout } = await execFileAsync("ffprobe", [
    "-v",
    "error",
    "-show_entries",
    "format=duration",
    "-of",
    "default=noprint_wrappers=1:nokey=1",
    outputPath,
  ]);
  const assembledDuration = parseFloat(stdout.trim());
  const diff = Math.abs(assembledDuration - expectedTotalDuration);
  if (diff > AI_VIDEO_DURATION_TOLERANCE) {
    throw new Error(
      `[ai-video] assembled bg duration ${assembledDuration.toFixed(3)}s differs from spec ${expectedTotalDuration.toFixed(3)}s by ${diff.toFixed(3)}s (> ${AI_VIDEO_DURATION_TOLERANCE}s tolerance)`,
    );
  }

  return outputPath;
}

export async function generateAiVideoClips(
  scenes: Scene[],
  pipelineId: string,
  videoModel: VideoModel,
): Promise<string> {
  const model = videoModel;

  const pipelineDir = path.join("src/video", pipelineId);
  await fs.promises.mkdir(pipelineDir, { recursive: true });

  const expectedTotal = scenes[scenes.length - 1]!.endSec;

  // Submit and poll in batches of 2 — only start the next batch after the previous completes
  const BATCH_SIZE = 2;
  const jobIds: string[] = [];
  const videoUrls: string[] = [];

  for (let b = 0; b < scenes.length; b += BATCH_SIZE) {
    const batch = scenes.slice(b, b + BATCH_SIZE);
    console.log(
      `[ai-video:${pipelineId}] submitting batch ${Math.floor(b / BATCH_SIZE) + 1} (scenes ${b}–${b + batch.length - 1})...`,
    );
    const batchIds = await Promise.all(
      batch.map((scene) => submitSceneJob(scene, model)),
    );
    jobIds.push(...batchIds);

    console.log(
      `[ai-video:${pipelineId}] polling batch ${Math.floor(b / BATCH_SIZE) + 1}...`,
    );
    const batchUrls = await Promise.all(
      batchIds.map((id) => pollJobUntilDone(id)),
    );
    videoUrls.push(...batchUrls);
  }

  const normalizedPaths: string[] = [];

  for (let i = 0; i < scenes.length; i++) {
    const scene = scenes[i]!;
    const jobId = jobIds[i]!;
    const rawPath = path.join(pipelineDir, `clip-${i}-raw.mp4`);
    const normPath = path.join(pipelineDir, `clip-${i}.mp4`);
    const sceneDuration = scene.endSec - scene.startSec;

    // videoUrls[i] is kept in case we need the URL for logging; download via SDK stream
    console.log(
      `[ai-video:${pipelineId}] downloading clip ${i} (url=${videoUrls[i]})...`,
    );
    await downloadClip(jobId, rawPath);

    console.log(`[ai-video:${pipelineId}] validating clip ${i}...`);
    await validateClipWithFfprobe(rawPath);

    console.log(`[ai-video:${pipelineId}] normalizing clip ${i}...`);
    await normalizeClip(rawPath, normPath, sceneDuration);

    await fs.promises.unlink(rawPath).catch(() => {});
    normalizedPaths.push(normPath);
  }

  console.log(
    `[ai-video:${pipelineId}] concatenating ${normalizedPaths.length} clips...`,
  );
  const assembledPath = await concatenateClips(
    normalizedPaths,
    pipelineDir,
    expectedTotal,
  );

  console.log(
    `[ai-video:${pipelineId}] bg-assembled.mp4 ready at ${assembledPath}`,
  );
  return assembledPath;
}
