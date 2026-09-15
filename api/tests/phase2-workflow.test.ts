import assert from "node:assert/strict";
import test from "node:test";
import {
  EXPLAINER_STAGES,
  assertDeliveredDuration,
  inferLegacyCompletedStages,
} from "../src/helpers/workflow.helper";
import {
  dispatchExplainerWorkflow,
  WorkflowAlreadyRunningError,
  type StageClaim,
} from "../src/services/pipeline/workflow-dispatcher.service";

test("dispatcher skips durable successes and resumes at the first unfinished stage", async () => {
  const completed = new Set<string>(["script", "fact_check"]);
  const executed: string[] = [];
  await dispatchExplainerWorkflow({
    pipelineId: "pipeline-1", userId: "user-1", executionKey: "job-2",
    checkpoints: {
      claim: async ({ stage }): Promise<StageClaim> => ({ state: completed.has(stage) ? "succeeded" : "claimed" }),
      complete: async ({ stage }) => { completed.add(stage); },
      fail: async () => {},
    },
    executor: { execute: async (stage) => { executed.push(stage); } },
  });
  assert.deepEqual(executed, EXPLAINER_STAGES.slice(2));
});

test("interruption is persisted and replay does not repeat successful work", async () => {
  const states = new Map<string, StageClaim["state"]>();
  let failVideo = true;
  const executions: string[] = [];
  const checkpoints = {
    claim: async ({ stage }: { stage: string }): Promise<StageClaim> => ({
      state: states.get(stage) === "succeeded" ? "succeeded" : "claimed",
    }),
    complete: async ({ stage }: { stage: string }) => { states.set(stage, "succeeded"); },
    fail: async ({ stage }: { stage: string }) => { states.set(stage, "claimed"); },
  };
  const executor = { execute: async (stage: string) => {
    executions.push(stage);
    if (stage === "video" && failVideo) throw new Error("interrupted");
  } };
  await assert.rejects(dispatchExplainerWorkflow({
    pipelineId: "pipeline-1", userId: "user-1", executionKey: "job-1",
    checkpoints, executor,
  }), /interrupted/);
  const firstScriptExecutions = executions.filter((stage) => stage === "script").length;
  failVideo = false;
  await dispatchExplainerWorkflow({
    pipelineId: "pipeline-1", userId: "user-1", executionKey: "job-2",
    checkpoints, executor,
  });
  assert.equal(executions.filter((stage) => stage === "script").length, firstScriptExecutions);
  assert.equal(executions.filter((stage) => stage === "video").length, 2);
});

test("concurrent replay stops when a stage lease is active", async () => {
  await assert.rejects(dispatchExplainerWorkflow({
    pipelineId: "pipeline-1", userId: "user-1", executionKey: "job-2",
    checkpoints: {
      claim: async () => ({ state: "in_progress" }),
      complete: async () => {}, fail: async () => {},
    },
    executor: { execute: async () => { throw new Error("must not run"); } },
  }), (error) => error instanceof WorkflowAlreadyRunningError && error.stage === "script");
});

test("legacy progress maps to explainer checkpoints without assuming unsaved work", () => {
  assert.deepEqual(inferLegacyCompletedStages({
    pipelineStatus: "failed", draftScript: {}, finalScript: {}, videoSpec: {},
    soundSpec: {}, s3key: null, thumbnailUrl: null, tiktokPublishId: null,
  }), ["script", "fact_check", "linguistic_review", "video_spec"]);
});

test("legacy final script does not claim a linguistic review that never ran", () => {
  assert.deepEqual(inferLegacyCompletedStages({
    pipelineStatus: "failed", draftScript: {}, finalScript: {}, videoSpec: null,
    soundSpec: null, s3key: null,
  }), ["script", "fact_check"]);
});

test("legacy container-local audio is not durable proof when its artifact was never migrated", () => {
  assert.deepEqual(inferLegacyCompletedStages({
    pipelineStatus: "failed", draftScript: {}, finalScript: {}, videoSpec: {},
    soundSpec: { audioFilePath: "/missing/container/narration.wav" }, s3key: null,
  }), ["script", "fact_check", "linguistic_review", "video_spec"]);
  assert.deepEqual(inferLegacyCompletedStages({
    pipelineStatus: "sound_generated", draftScript: {}, finalScript: {}, videoSpec: {},
    soundSpec: { artifactKey: "workflow/v1/audio/narration" }, s3key: null,
  }), ["script", "fact_check", "linguistic_review", "video_spec", "audio"]);
});

test("delivered duration enforces trusted trial and standard limits", () => {
  assert.doesNotThrow(() => assertDeliveredDuration(30, 30));
  assert.doesNotThrow(() => assertDeliveredDuration(75, 75));
  assert.throws(() => assertDeliveredDuration(30.001, 30), /exceeds 30s/);
  assert.throws(() => assertDeliveredDuration(75.001, 75), /exceeds 75s/);
});
