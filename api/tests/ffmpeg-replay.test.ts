import assert from "node:assert/strict";
import { execFile } from "node:child_process";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import test from "node:test";
import { randomUUID } from "node:crypto";
import { promisify } from "node:util";
import {
  concatenateClips,
  normalizeClip,
} from "../src/services/pipeline/agents/ai-video-generator.agent";
import {
  burnThumbnailIntoVideo,
  compositeVideo,
  getVideoDuration,
  validateFinalVideo,
} from "../src/helpers/video.helper";

const execFileAsync = promisify(execFile);

async function ffmpeg(args: string[]): Promise<void> {
  await execFileAsync("ffmpeg", ["-nostdin", "-y", ...args]);
}

async function makeSourceClip(filePath: string, duration: number): Promise<void> {
  await ffmpeg([
    "-f",
    "lavfi",
    "-i",
    `color=c=blue:s=160x284:r=30:d=${duration}`,
    "-f",
    "lavfi",
    "-i",
    `sine=frequency=440:sample_rate=44100:duration=${duration}`,
    "-shortest",
    "-c:v",
    "libx264",
    "-pix_fmt",
    "yuv420p",
    "-c:a",
    "aac",
    filePath,
  ]);
}

async function assertNoTemporaryFiles(
  directory: string,
  relevantName = "",
): Promise<void> {
  const entries = await fs.promises.readdir(directory);
  assert.equal(
    entries.some(
      (entry) =>
        entry.includes(relevantName) &&
        (entry.includes(".tmp") || entry.startsWith(".concat.")),
    ),
    false,
    `temporary FFmpeg files remain in ${directory}: ${entries.join(", ")}`,
  );
}

async function topFrameLumaRange(filePath: string): Promise<number> {
  const { stdout, stderr } = await execFileAsync("ffmpeg", [
    "-ss", "0.3", "-i", filePath,
    "-vf", "crop=720:360:0:0,signalstats,metadata=mode=print",
    "-frames:v", "1", "-f", "null", "-",
  ]);
  const metadata = `${stdout}\n${stderr}`;
  const minimum = Number(metadata.match(/lavfi\.signalstats\.YMIN=(\d+)/)?.[1]);
  const maximum = Number(metadata.match(/lavfi\.signalstats\.YMAX=(\d+)/)?.[1]);
  assert.ok(Number.isFinite(minimum) && Number.isFinite(maximum), metadata);
  return maximum - minimum;
}

test("normalization and concatenation safely replace replay leftovers", async (t) => {
  const directory = await fs.promises.mkdtemp(
    path.join(os.tmpdir(), "ffmpeg-replay-"),
  );
  t.after(() => fs.promises.rm(directory, { recursive: true, force: true }));

  const rawA = path.join(directory, "raw-a.mp4");
  const rawB = path.join(directory, "raw-b.mp4");
  const clipA = path.join(directory, "clip-a.mp4");
  const clipB = path.join(directory, "clip-b.mp4");
  await Promise.all([
    makeSourceClip(rawA, 0.5),
    makeSourceClip(rawB, 0.5),
  ]);

  await fs.promises.writeFile(clipA, "interrupted normalization");
  await normalizeClip(rawA, clipA, 0.5);
  await normalizeClip(rawA, clipA, 0.5);
  await normalizeClip(rawB, clipB, 0.5);
  await validateFinalVideo(clipA, 1);

  const assembled = path.join(directory, "bg-assembled.mp4");
  await fs.promises.writeFile(assembled, "interrupted concatenation");
  assert.equal(
    await concatenateClips([clipA, clipB], directory, 1),
    assembled,
  );
  assert.equal(
    await concatenateClips([clipA, clipB], directory, 1),
    assembled,
  );
  assert.ok(Math.abs((await getVideoDuration(assembled)) - 1) < 0.25);

  const completedBytes = await fs.promises.readFile(assembled);
  await assert.rejects(
    concatenateClips([clipA, clipB], directory, 10),
    /differs from spec/,
  );
  assert.deepEqual(await fs.promises.readFile(assembled), completedBytes);
  await assertNoTemporaryFiles(directory);
});

test("final compositing and thumbnail insertion are replay-safe", async (t) => {
  const pipelineId = `ffmpeg-replay-${randomUUID()}`;
  const videoDir = path.resolve("src/video");
  const audioDir = path.resolve("src/audio");
  const frameDir = path.join(videoDir, pipelineId);
  const sourceVideo = path.join(frameDir, "background.mp4");
  const audioPath = path.join(audioDir, `${pipelineId}.wav`);
  const compositeOutput = path.join(videoDir, `${pipelineId}-output.mp4`);
  const thumbnailOutput = path.join(videoDir, `${pipelineId}-with-thumb.mp4`);
  const thumbnailPath = path.join(frameDir, "thumbnail.jpg");

  await Promise.all([
    fs.promises.mkdir(frameDir, { recursive: true }),
    fs.promises.mkdir(audioDir, { recursive: true }),
  ]);
  t.after(async () => {
    await Promise.all([
      fs.promises.rm(frameDir, { recursive: true, force: true }),
      fs.promises.unlink(audioPath).catch(() => {}),
      fs.promises.unlink(compositeOutput).catch(() => {}),
      fs.promises.unlink(thumbnailOutput).catch(() => {}),
    ]);
  });

  await Promise.all([
    ffmpeg([
      "-f",
      "lavfi",
      "-i",
      "color=c=green:s=720x1280:r=30:d=0.6",
      "-c:v",
      "libx264",
      "-pix_fmt",
      "yuv420p",
      sourceVideo,
    ]),
    ffmpeg([
      "-f",
      "lavfi",
      "-i",
      "sine=frequency=330:sample_rate=44100:duration=0.6",
      audioPath,
    ]),
    ffmpeg([
      "-f",
      "lavfi",
      "-i",
      "color=c=yellow:s=360x640",
      "-frames:v",
      "1",
      thumbnailPath,
    ]),
  ]);

  await fs.promises.writeFile(compositeOutput, "interrupted composite");
  const captions = [{ text: "Replay safe", startSec: 0, endSec: 0.6 }];
  const timedOverlays = [{ text: "3 · Timed item", startSec: 0, endSec: 0.6 }];
  assert.equal(
    await compositeVideo(pipelineId, captions, sourceVideo, timedOverlays, 0.6),
    `src/video/${pipelineId}-output.mp4`,
  );
  await compositeVideo(pipelineId, captions, sourceVideo, timedOverlays, 0.6);
  await validateFinalVideo(compositeOutput, 1);
  assert.ok(
    await topFrameLumaRange(compositeOutput) > 100,
    "timed overlay was not visibly composited into the top of the delivered frame",
  );

  const thumbnail = await fs.promises.readFile(thumbnailPath);
  await fs.promises.writeFile(thumbnailOutput, "interrupted thumbnail render");
  assert.equal(
    await burnThumbnailIntoVideo(compositeOutput, thumbnail, pipelineId),
    `src/video/${pipelineId}-with-thumb.mp4`,
  );
  await burnThumbnailIntoVideo(compositeOutput, thumbnail, pipelineId);
  await validateFinalVideo(thumbnailOutput, 2);

  const completedBytes = await fs.promises.readFile(thumbnailOutput);
  await assert.rejects(
    burnThumbnailIntoVideo(compositeOutput, Buffer.from("not a jpeg"), pipelineId),
  );
  assert.deepEqual(await fs.promises.readFile(thumbnailOutput), completedBytes);
  await assertNoTemporaryFiles(videoDir, pipelineId);
  assert.deepEqual(
    (await fs.promises.readdir(frameDir)).filter((entry) =>
      entry.startsWith(".captions.")),
    [],
  );
});
