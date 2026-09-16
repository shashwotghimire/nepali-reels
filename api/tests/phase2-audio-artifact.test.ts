import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import test from "node:test";
import { s3 } from "../src/services/s3.service";
import Reels from "../src/models/reels.model";
import WorkflowArtifact from "../src/models/workflow-artifact.model";
import { resolvePipelineAudioPathService } from "../src/services/reels.service";

const pipelineId = "77777777-7777-4777-8777-777777777777";
const userId = "audio-owner";

test("the audio API service restores an owned durable narration artifact", async () => {
  const originals = {
    reelFindOne: Reels.findOne,
    artifactFindOne: WorkflowArtifact.findOne,
    s3Send: s3.send,
  };
  const audioPath = path.resolve(`src/audio/${pipelineId}.wav`);
  await fs.promises.rm(audioPath, { force: true });
  let downloads = 0;

  Object.assign(Reels, {
    findOne: async ({ where }: { where: { id: string; userId: string } }) => {
      assert.deepEqual(where, { id: pipelineId, userId });
      return {
        id: pipelineId,
        userId,
        soundSpec: { artifactKey: "v1/audio/narration" },
      };
    },
  });
  Object.assign(WorkflowArtifact, {
    findOne: async () => ({
      storageProvider: "s3",
      storageKey: `workflow/${pipelineId}/narration.wav`,
    }),
  });
  Object.assign(s3, {
    send: async () => {
      downloads += 1;
      return {
        Body: {
          transformToByteArray: async () => Uint8Array.from([82, 73, 70, 70]),
        },
      };
    },
  });

  try {
    const resolved = await resolvePipelineAudioPathService(userId, pipelineId);
    assert.equal(resolved, audioPath);
    assert.equal(downloads, 1);
    assert.deepEqual(await fs.promises.readFile(audioPath), Buffer.from("RIFF"));
  } finally {
    Object.assign(Reels, { findOne: originals.reelFindOne });
    Object.assign(WorkflowArtifact, { findOne: originals.artifactFindOne });
    Object.assign(s3, { send: originals.s3Send });
    await fs.promises.rm(audioPath, { force: true });
  }
});
