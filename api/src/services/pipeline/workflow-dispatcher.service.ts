import {
  EXPLAINER_STAGES,
  EXPLAINER_WORKFLOW_VERSION,
  type ExplainerStage,
} from "../../helpers/workflow.helper";

export interface WorkflowStageLease {
  stageAttemptId: string;
  leaseOwner: string;
  assertOwned(): Promise<void>;
}

export type StageClaim = {
  state: "claimed" | "succeeded" | "in_progress";
  output?: object | null;
  lease?: WorkflowStageLease;
};

export interface WorkflowCheckpointPort {
  /** Renew often enough that one long provider wait cannot outlive its lease. */
  leaseRenewalIntervalMs?: number;
  claim(input: {
    pipelineId: string;
    userId: string;
    workflowVersion: number;
    stage: ExplainerStage;
    executionKey: string;
  }): Promise<StageClaim>;
  renew?(input: {
    pipelineId: string;
    workflowVersion: number;
    stage: ExplainerStage;
    executionKey: string;
  }): Promise<void>;
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
    lease?: WorkflowStageLease,
  ): Promise<object | null | void>;
}

export class WorkflowAlreadyRunningError extends Error {
  constructor(readonly stage: ExplainerStage) {
    super(`Workflow stage ${stage} is already running`);
    this.name = "WorkflowAlreadyRunningError";
  }
}

export function isWorkflowContentionError(error: unknown): boolean {
  return error instanceof WorkflowAlreadyRunningError
    || (error instanceof Error && error.name === "WorkflowAlreadyRunningError");
}

export function shouldMarkPipelineFailed(error: unknown): boolean {
  return !isWorkflowContentionError(error);
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
    let renewalTimer: ReturnType<typeof setInterval> | undefined;
    let renewalError: unknown;
    if (input.checkpoints.renew && input.checkpoints.leaseRenewalIntervalMs) {
      const renew = input.checkpoints.renew;
      const renewalInput = {
        pipelineId: input.pipelineId,
        workflowVersion: EXPLAINER_WORKFLOW_VERSION,
        stage,
        executionKey: input.executionKey,
      };
      renewalTimer = setInterval(() => {
        void renew(renewalInput).catch((error) => { renewalError ??= error; });
      }, input.checkpoints.leaseRenewalIntervalMs);
      renewalTimer.unref?.();
    }
    try {
      await claim.lease?.assertOwned();
      const output = (await input.executor.execute(stage, completedOutputs, claim.lease)) ?? null;
      if (renewalError) throw renewalError;
      await claim.lease?.assertOwned();
      await input.checkpoints.complete({
        pipelineId: input.pipelineId,
        workflowVersion: EXPLAINER_WORKFLOW_VERSION,
        stage,
        executionKey: input.executionKey,
        output,
      });
      completedOutputs.set(stage, output);
    } catch (error) {
      // A lost lease makes fail itself reject. Preserve the original error and
      // rely on repository fencing to leave the successor's row untouched.
      await input.checkpoints.fail({
        pipelineId: input.pipelineId,
        workflowVersion: EXPLAINER_WORKFLOW_VERSION,
        stage,
        executionKey: input.executionKey,
        error: error instanceof Error ? error.message : String(error),
      }).catch(() => {});
      throw error;
    } finally {
      if (renewalTimer) clearInterval(renewalTimer);
    }
  }
}
