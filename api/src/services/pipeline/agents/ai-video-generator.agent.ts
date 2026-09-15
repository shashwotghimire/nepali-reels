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
import { beginProviderAttempt, finishProviderAttempt } from "../../../repositories/provider-usage.repository";
import { calculateVideoCost } from "../../../utils/cost.util";
import type { MeteringContext } from "../llm-metering";
import {
  ProviderJobFailedError,
  generateVideoScene,
  type VideoSceneJobState,
} from "../video-scene-generation.service";
import {
  getWorkflowArtifactDetails,
  persistInlineWorkflowArtifact,
  persistWorkflowFile,
  restoreWorkflowFile,
} from "../workflow-artifact.service";
import {
  stableFingerprint,
  workflowArtifactKey,
} from "../../../helpers/workflow-artifact.helper";
import { EXPLAINER_WORKFLOW_VERSION } from "../../../helpers/workflow.helper";

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
      throw new ProviderJobFailedError(
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
  context?: MeteringContext,
): Promise<string> {
  if (!context?.budget) {
    throw new Error("AI video generation requires a trusted provider budget context");
  }
  const model = videoModel;

  const pipelineDir = path.join("src/video", pipelineId);
  await fs.promises.mkdir(pipelineDir, { recursive: true });

  const expectedTotal = scenes[scenes.length - 1]!.endSec;

  // Submit and poll in batches of 2 — only start the next batch after the previous completes
  const BATCH_SIZE = 2;
  const normalizedPaths: string[] = [];

  for (let b = 0; b < scenes.length; b += BATCH_SIZE) {
    const batch = scenes.slice(b, b + BATCH_SIZE);
    console.log(
      `[ai-video:${pipelineId}] submitting batch ${Math.floor(b / BATCH_SIZE) + 1} (scenes ${b}–${b + batch.length - 1})...`,
    );
    const settled = await Promise.allSettled(batch.map(async (scene, batchIndex) => {
      const sceneIndex = b + batchIndex;
      const requestedSeconds = Math.round(scene.endSec - scene.startSec);
      const fingerprint = stableFingerprint({
        scene,
        model,
        aspectRatio: "9:16",
        resolution: "480p",
        generateAudio: false,
      });
      const stateKey = workflowArtifactKey(
        EXPLAINER_WORKFLOW_VERSION,
        "video-scene-state",
        String(sceneIndex),
      );
      const clipKey = workflowArtifactKey(
        EXPLAINER_WORKFLOW_VERSION,
        "video-scene",
        String(sceneIndex),
      );
      const normPath = path.join(pipelineDir, `clip-${sceneIndex}.mp4`);

      return generateVideoScene({
        scene,
        model,
        fingerprint,
        budget: context.budget!,
        store: {
          async load() {
            const artifact = await getWorkflowArtifactDetails({
              pipelineId,
              userId: context.userId,
              artifactKey: stateKey,
            });
            return artifact?.fingerprint === fingerprint
              ? artifact.metadata as VideoSceneJobState | null
              : null;
          },
          async save(state) {
            await persistInlineWorkflowArtifact({
              pipelineId,
              userId: context.userId,
              artifactKey: stateKey,
              kind: "video_scene_state",
              fingerprint,
              metadata: state,
            });
          },
          async restoreCompleted() {
            return await restoreWorkflowFile({
              pipelineId,
              userId: context.userId,
              artifactKey: clipKey,
              destination: normPath,
              fingerprint,
            }) ? normPath : null;
          },
          async persistCompleted(localPath, state) {
            await persistWorkflowFile({
              pipelineId,
              userId: context.userId,
              artifactKey: clipKey,
              kind: "video_scene",
              filePath: localPath,
              extension: "mp4",
              contentType: "video/mp4",
              fingerprint,
              metadata: {
                providerJobId: state.providerJobId,
                providerAttemptId: state.providerAttemptId,
                attemptNumber: state.attemptNumber,
              },
            });
            return clipKey;
          },
        },
        provider: {
          submit: submitSceneJob,
          async waitForCompletion(jobId) {
            await pollJobUntilDone(jobId);
          },
          async materialize(jobId) {
            const rawPath = path.join(pipelineDir, `clip-${sceneIndex}-raw.mp4`);
            await downloadClip(jobId, rawPath);
            await validateClipWithFfprobe(rawPath);
            await normalizeClip(rawPath, normPath, scene.endSec - scene.startSec);
            await fs.promises.unlink(rawPath).catch(() => {});
            return normPath;
          },
        },
        usage: {
          async begin({ attemptId, attemptNumber }) {
            await beginProviderAttempt({
              attemptId,
              userId: context.userId,
              pipelineId: context.pipelineId,
              operation: "video_generation",
              stage: context.stage,
              provider: "openrouter",
              model,
              configuration: {
                duration: requestedSeconds,
                aspectRatio: "9:16",
                resolution: "480p",
                generateAudio: false,
                sceneIndex,
                attempt: attemptNumber,
              },
            });
          },
          async cancelBeforeStart({ attemptId, error }) {
            await finishProviderAttempt({
              attemptId,
              status: "failed",
              usage: { generatedVideoSeconds: 0 },
              costUsd: 0,
              costProvenance: "actual",
              error,
            });
          },
          async succeed({ attemptId, generatedSeconds }) {
            await finishProviderAttempt({
              attemptId,
              status: "succeeded",
              usage: { generatedVideoSeconds: generatedSeconds },
              costUsd: calculateVideoCost(generatedSeconds, videoModel).toString(),
              costProvenance: "estimated",
              rateVersion: "planning-2026-09-14",
            });
          },
          async fail({ attemptId, error }) {
            await finishProviderAttempt({
              attemptId,
              status: "failed",
              costUsd: null,
              costProvenance: "unknown",
              error,
            });
          },
        },
      });
    }));
    const failed = settled.find((result) => result.status === "rejected");
    if (failed?.status === "rejected") throw failed.reason;
    const batchResults = settled.map((result) => {
      if (result.status !== "fulfilled") throw result.reason;
      return result.value;
    });
    normalizedPaths.push(...batchResults);
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
