import assert from "node:assert/strict";
import test from "node:test";
import { Job } from "bullmq";
import { reelReadyNotificationJobId } from "../src/helpers/notification.helper";
import { createExplainerDurationPolicy } from "../src/services/pipeline/explainer-duration-policy.service";
import type { ResolvedGenerationEntitlement } from "../src/services/pipeline/entitlement-resolution.service";
import type { ScriptOutput } from "../src/schema/script-writer.schema";
import type { VideoSpec } from "../src/schema/video-spec.schema";

class LocallyValidatedJob extends Job {
  validateWithoutRedis() {
    this.validateOptions(this.asJSON());
  }
}

const fakeQueue = {
  toKey: (key: string) => `bull:email:${key}`,
  qualifiedName: "bull:email",
  keys: {}, client: Promise.resolve({}), redisVersion: "7.0.0", opts: {},
  closing: Promise.resolve(), databaseType: "redis",
};

function access(
  kind: "verified_trial" | "subscription",
): ResolvedGenerationEntitlement {
  return kind === "verified_trial" ? {
    accessId: "trial-grant", accessKind: kind, userId: "user-1",
    entitlement: {
      id: "trial", maxOutputDurationSeconds: 30,
      aiRevisionsPerVideo: 1, thumbnailsPerVideo: 0,
    },
  } : {
    accessId: "paid-grant", accessKind: kind, userId: "user-1",
    entitlement: {
      id: "creator", maxOutputDurationSeconds: 75,
      aiRevisionsPerVideo: 2, thumbnailsPerVideo: 1,
    },
  };
}

function script(durations: number[]): ScriptOutput {
  const total = durations.reduce((sum, seconds) => sum + seconds, 0);
  return {
    hookOptions: [
      { text: "a", style: "question" },
      { text: "b", style: "shock" },
      { text: "c", style: "story" },
    ],
    selectedHook: "a", narrationNp: "कथा",
    shotPlan: durations.map((durationSec, index) => ({
      index, durationSec, visual: "scene", cameraOrMotion: "still",
    })),
    onScreenText: [], captions: [
      { startSec: 0, endSec: total / 3, text: "a" },
      { startSec: total / 3, endSec: total * 2 / 3, text: "b" },
      { startSec: total * 2 / 3, endSec: total, text: "c" },
    ],
    titleOptions: ["a", "b"], hashtags: ["a", "b", "c"],
    platformDescription: "a", estDurationSec: total,
  };
}

function spec(durations: number[]): VideoSpec {
  let cursor = 0;
  return {
    voiceoverText: "कथा",
    scenes: durations.map((duration) => {
      const startSec = cursor;
      cursor += duration;
      return { startSec, endSec: cursor, bgPrompt: "scene", captionText: "कथा" };
    }),
    musicDirection: "none", thumbnailText: "कथा",
  };
}

test("notification ID passes the installed BullMQ validator without Redis", () => {
  const jobId = reelReadyNotificationJobId("22222222-2222-4222-8222-222222222222");
  assert.equal(jobId, "reel-ready-22222222-2222-4222-8222-222222222222");
  const job = new LocallyValidatedJob(
    fakeQueue as never, "reel-ready", {}, { jobId },
  );
  assert.doesNotThrow(() => job.validateWithoutRedis());
  const rejected = new LocallyValidatedJob(
    fakeQueue as never, "reel-ready", {}, { jobId: "reel-ready:pipeline" },
  );
  assert.throws(() => rejected.validateWithoutRedis(), /Custom Id cannot contain :/);
});

test("trial workflow policy drives 30s prompts, planning, no thumbnail, and final validation", async () => {
  const containerLimits: number[] = [];
  const policy = createExplainerDurationPolicy(
    access("verified_trial"),
    async (_path, maximum) => { containerLimits.push(maximum); },
  );
  assert.deepEqual(policy.promptDuration, {
    targetDurationSeconds: 30, maximumDurationSeconds: 30,
  });
  assert.equal(policy.includeThumbnail, false);
  policy.validateScript(script([10, 10, 10]));
  policy.validateVideoSpec(spec([10, 10, 10]));
  await policy.validateRenderedVideo("trial.mp4", 30);
  assert.deepEqual(containerLimits, [30]);
  await assert.rejects(policy.validateRenderedVideo("trial.mp4", 30.001), /30-second trial limit/);
});

test("paid workflow reserves thumbnail time across prompts, planning, and final validation", async () => {
  const containerLimits: number[] = [];
  const policy = createExplainerDurationPolicy(
    access("subscription"),
    async (_path, maximum) => { containerLimits.push(maximum); },
  );
  assert.deepEqual(policy.promptDuration, {
    targetDurationSeconds: 74, maximumDurationSeconds: 74,
  });
  assert.equal(policy.includeThumbnail, true);
  assert.equal(policy.thumbnailDurationSeconds, 1);
  policy.validateScript(script([10, 10, 10, 11, 11, 11, 11]));
  policy.validateVideoSpec(spec([10, 10, 10, 11, 11, 11, 11]));
  await policy.validateRenderedVideo("paid.mp4", 75);
  assert.deepEqual(containerLimits, [75]);
  assert.throws(() => policy.validateVideoSpec(spec([10, 10, 10, 11, 11, 11, 12])), /between 12s and 74s/);
});
