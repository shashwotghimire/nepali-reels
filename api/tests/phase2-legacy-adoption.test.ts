import assert from "node:assert/strict";
import test from "node:test";
import { seedLegacyExplainerCheckpoints } from "../src/services/pipeline/workflow-checkpoint.service";

const legacyPipeline = () => ({
  pipelineStatus: "failed" as const,
  draftScript: {}, finalScript: {}, videoSpec: {},
  soundSpec: { audioFilePath: "/old-worker/narration.wav" },
  s3key: null,
});

function dependencies(input: {
  hasAttempts: boolean;
  fileExists?: boolean;
  seeded: string[];
  persisted?: object[];
  saved?: object[];
}) {
  return {
    hasAttempts: async () => input.hasAttempts,
    seedStages: async ({ stages }: { stages: { stage: string }[] }) => {
      input.seeded.push(...stages.map(({ stage }) => stage));
      return [];
    },
    fileExists: () => input.fileExists ?? false,
    persistFile: async (artifact: object) => { input.persisted?.push(artifact); },
    saveSoundSpec: async (_pipelineId: string, _userId: string, soundSpec: object) => {
      input.saved?.push(soundSpec);
    },
  } as never;
}

test("legacy adoption regenerates a missing worker-local WAV instead of seeding audio", async () => {
  const seeded: string[] = [];
  await seedLegacyExplainerCheckpoints({
    pipelineId: "pipeline-1", userId: "user-1", pipeline: legacyPipeline(),
  }, dependencies({ hasAttempts: false, seeded }));
  assert.deepEqual(seeded, ["script", "fact_check", "linguistic_review", "video_spec"]);
  assert.equal(seeded.includes("audio"), false);
});

test("legacy adoption migrates an existing WAV before marking audio complete", async () => {
  const seeded: string[] = [];
  const persisted: object[] = [];
  const saved: object[] = [];
  await seedLegacyExplainerCheckpoints({
    pipelineId: "pipeline-1", userId: "user-1", pipeline: legacyPipeline(),
  }, dependencies({
    hasAttempts: false,
    fileExists: true,
    seeded,
    persisted,
    saved,
  }));
  assert.equal(persisted.length, 1);
  assert.equal(saved.length, 1);
  assert.equal(seeded.includes("audio"), true);
  assert.equal(
    (saved[0] as { artifactKey?: string }).artifactKey,
    "v1/audio/narration",
  );
});

test("new versioned checkpoints disable legacy inference on retry", async () => {
  const seeded: string[] = [];
  await seedLegacyExplainerCheckpoints({
    pipelineId: "pipeline-1", userId: "user-1", pipeline: legacyPipeline(),
  }, dependencies({ hasAttempts: true, seeded }));
  assert.deepEqual(seeded, []);
});
