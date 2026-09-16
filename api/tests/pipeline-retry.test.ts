import assert from "node:assert/strict";
import test from "node:test";
import { EXPLAINER_STAGES } from "../src/helpers/workflow.helper";
import { retryPipelineService } from "../src/services/pipeline/pipeline.service";
import {
  dispatchExplainerWorkflow,
  type StageClaim,
} from "../src/services/pipeline/workflow-dispatcher.service";

const pipelineId = "22222222-2222-4222-8222-222222222222";
const userId = "user-1";

const failedPipeline = (overrides: Record<string, unknown> = {}) => ({
  pipelineStatus: "failed",
  draftScript: {},
  finalScript: {},
  videoSpec: {},
  soundSpec: { artifactKey: "workflow/v1/audio/narration" },
  s3key: "reels/pipeline/final.mp4",
  thumbnailUrl: null,
  tiktokPublishId: null,
  ...overrides,
});

test("notification retry restores video_generated and reuses generation and upload checkpoints", async () => {
  const succeeded = new Map<string, object | null>();
  const executions: string[] = [];
  let failNotification = true;
  const checkpoints = {
    claim: async ({ stage }: { stage: string }): Promise<StageClaim> => succeeded.has(stage)
      ? { state: "succeeded", output: succeeded.get(stage) }
      : { state: "claimed" },
    complete: async ({ stage, output }: { stage: string; output?: object | null }) => {
      succeeded.set(stage, output ?? null);
    },
    fail: async () => {},
  };
  const executor = {
    execute: async (stage: string) => {
      executions.push(stage);
      if (stage === "notify" && failNotification) throw new Error("email queue unavailable");
      return { stage };
    },
  };

  await assert.rejects(dispatchExplainerWorkflow({
    pipelineId, userId, executionKey: "first-job", checkpoints, executor,
  }), /email queue unavailable/);
  assert.deepEqual(executions, EXPLAINER_STAGES.slice(0, EXPLAINER_STAGES.indexOf("notify") + 1));

  let resetStatus: string | undefined;
  const retry = await retryPipelineService(userId, pipelineId, {
    findPipeline: async () => failedPipeline() as never,
    resetPipeline: async (_pipelineId, _userId, status) => {
      resetStatus = status;
      return failedPipeline({ pipelineStatus: status }) as never;
    },
  });
  assert.equal(retry.resumeFrom, "video_generated");
  assert.equal(resetStatus, "video_generated");

  failNotification = false;
  await dispatchExplainerWorkflow({
    pipelineId, userId, executionKey: "retry-job", checkpoints, executor,
  });
  for (const stage of EXPLAINER_STAGES.slice(0, EXPLAINER_STAGES.indexOf("notify"))) {
    assert.equal(executions.filter((executed) => executed === stage).length, 1, `${stage} must be reused`);
  }
  assert.equal(executions.filter((stage) => stage === "upload").length, 1);
  assert.equal(executions.filter((stage) => stage === "notify").length, 2);
  assert.equal(executions.filter((stage) => stage === "publish").length, 1);
});

test("retry preserves an in-flight publish status when a publish ID exists", async () => {
  let resetStatus: string | undefined;
  const retry = await retryPipelineService(userId, pipelineId, {
    findPipeline: async () => failedPipeline({ tiktokPublishId: "publish-123" }) as never,
    resetPipeline: async (_pipelineId, _userId, status) => {
      resetStatus = status;
      return failedPipeline({ pipelineStatus: status }) as never;
    },
  });
  assert.equal(retry.resumeFrom, "publish_pending");
  assert.equal(resetStatus, "publish_pending");
});
