import {
  EXPLAINER_STAGES,
  EXPLAINER_WORKFLOW_VERSION,
  type ExplainerStage,
} from "../../helpers/workflow.helper";

export type StageClaim = {
  state: "claimed" | "succeeded" | "in_progress";
  output?: object | null;
};

export interface WorkflowCheckpointPort {
  claim(input: {
    pipelineId: string;
    userId: string;
    workflowVersion: number;
    stage: ExplainerStage;
    executionKey: string;
  }): Promise<StageClaim>;
  complete(input: {
    pipelineId: string;
    workflowVersion: number;
    stage: ExplainerStage;
    executionKey: string;
    output?: object | null;
  }): Promise<void>;
  fail(input: {
    pipelineId: string;
    workflowVersion: number;
    stage: ExplainerStage;
    executionKey: string;
    error: string;
  }): Promise<void>;
}

export interface WorkflowStageExecutor {
  execute(
    stage: ExplainerStage,
    completedOutputs: ReadonlyMap<ExplainerStage, object | null>,
  ): Promise<object | null | void>;
}

export class WorkflowAlreadyRunningError extends Error {
  constructor(readonly stage: ExplainerStage) {
    super(`Workflow stage ${stage} is already running`);
  }
}

/** Single create/resume path. Checkpoints decide which work is reused. */
export async function dispatchExplainerWorkflow(input: {
  pipelineId: string;
  userId: string;
  executionKey: string;
  checkpoints: WorkflowCheckpointPort;
  executor: WorkflowStageExecutor;
}): Promise<void> {
  const completedOutputs = new Map<ExplainerStage, object | null>();
  for (const stage of EXPLAINER_STAGES) {
    const claim = await input.checkpoints.claim({
      pipelineId: input.pipelineId,
      userId: input.userId,
      workflowVersion: EXPLAINER_WORKFLOW_VERSION,
      stage,
      executionKey: input.executionKey,
    });
    if (claim.state === "succeeded") {
      completedOutputs.set(stage, claim.output ?? null);
      continue;
    }
    if (claim.state === "in_progress") throw new WorkflowAlreadyRunningError(stage);
    try {
      const output = (await input.executor.execute(stage, completedOutputs)) ?? null;
      await input.checkpoints.complete({
        pipelineId: input.pipelineId,
        workflowVersion: EXPLAINER_WORKFLOW_VERSION,
        stage,
        executionKey: input.executionKey,
        output,
      });
      completedOutputs.set(stage, output);
    } catch (error) {
      await input.checkpoints.fail({
        pipelineId: input.pipelineId,
        workflowVersion: EXPLAINER_WORKFLOW_VERSION,
        stage,
        executionKey: input.executionKey,
        error: error instanceof Error ? error.message : String(error),
      });
      throw error;
    }
  }
}
