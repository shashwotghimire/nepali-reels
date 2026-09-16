import assert from "node:assert/strict";
import test from "node:test";
import { LIST_STAGES, STORY_STAGES } from "../src/helpers/workflow.helper";
import {
  dispatchWorkflow,
  type StageClaim,
} from "../src/services/pipeline/workflow-dispatcher.service";
import { dispatchPipelineService } from "../src/services/pipeline/pipeline.service";

for (const [name, stages] of [["Story", STORY_STAGES], ["List", LIST_STAGES]] as const) {
  test(`${name} uses its exact durable stage order`, async () => {
    const executed: string[] = [];
    await dispatchWorkflow({
      pipelineId: "pipeline-1",
      userId: "user-1",
      executionKey: "job-1",
      workflowVersion: 1,
      stages,
      checkpoints: {
        claim: async (): Promise<StageClaim> => ({ state: "claimed" }),
        complete: async () => {},
        fail: async () => {},
      },
      executor: { execute: async (stage) => { executed.push(stage); } },
    });
    assert.deepEqual(executed, stages);
  });

  test(`${name} replay reuses successful checkpoints after interruption`, async () => {
    const succeeded = new Set<string>();
    const executed: string[] = [];
    let interrupt = true;
    const failureStage = stages.includes("story_fact_safety" as never)
      ? "story_fact_safety"
      : "list_fact_check";
    const checkpoints = {
      claim: async ({ stage }: { stage: string }): Promise<StageClaim> => succeeded.has(stage)
        ? { state: "succeeded" }
        : { state: "claimed" },
      complete: async ({ stage }: { stage: string }) => { succeeded.add(stage); },
      fail: async () => {},
    };
    const executor = { execute: async (stage: string) => {
      executed.push(stage);
      if (stage === failureStage && interrupt) throw new Error("mock interruption");
    } };
    await assert.rejects(dispatchWorkflow({
      pipelineId: "pipeline-1", userId: "user-1", executionKey: "job-1",
      workflowVersion: 1, stages, checkpoints, executor,
    }), /mock interruption/);
    interrupt = false;
    await dispatchWorkflow({
      pipelineId: "pipeline-1", userId: "user-1", executionKey: "job-2",
      workflowVersion: 1, stages, checkpoints, executor,
    });
    assert.equal(executed.filter((stage) => stage === stages[0]).length, 1);
    assert.equal(executed.filter((stage) => stage === failureStage).length, 2);
  });
}

test("pipeline dispatch routes each persisted video type to only its dedicated workflow", async () => {
  for (const videoType of ["explainer", "story", "list"] as const) {
    const calls: string[] = [];
    const dependencies = {
      findPipeline: async () => ({ videoType }) as never,
      runExplainer: async () => { calls.push("explainer"); },
      runStory: async () => { calls.push("story"); },
      runList: async () => { calls.push("list"); },
    };
    await dispatchPipelineService(
      "user-1", "pipeline-1", "job-1", false, "lease-1", dependencies,
    );
    assert.deepEqual(calls, [videoType]);
  }
});
