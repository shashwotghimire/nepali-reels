import {
  EXPLAINER_STAGES,
  EXPLAINER_WORKFLOW_VERSION,
  type WorkflowStage,
} from "../../helpers/workflow.helper";
import {
  WorkflowLeaseLostError,
  type WorkflowLeaseGuard,
} from "../../types/workflow-lease.types";

export interface WorkflowStageLease extends WorkflowLeaseGuard {}

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
    stage: WorkflowStage;
    executionKey: string;
  }): Promise<StageClaim>;
  renew?(input: {
    pipelineId: string;
    workflowVersion: number;
    stage: WorkflowStage;
    executionKey: string;
  }): Promise<void>;
  complete(input: {
    pipelineId: string;
    workflowVersion: number;
    stage: WorkflowStage;
    executionKey: string;
    output?: object | null;
  }): Promise<void>;
  fail(input: {
    pipelineId: string;
    workflowVersion: number;
    stage: WorkflowStage;
    executionKey: string;
    error: string;
  }): Promise<void>;
}

export interface WorkflowStageExecutor {
  execute(
    stage: WorkflowStage,
    completedOutputs: ReadonlyMap<WorkflowStage, object | null>,
    lease?: WorkflowStageLease,
  ): Promise<object | null | void>;
}

export class WorkflowAlreadyRunningError extends Error {
  constructor(readonly stage: WorkflowStage) {
    super(`Workflow stage ${stage} is already running`);
    this.name = "WorkflowAlreadyRunningError";
  }
}

export class WorkflowAwaitingApprovalError extends Error {
  constructor() {
    super("Workflow is waiting for script approval");
    this.name = "WorkflowAwaitingApprovalError";
  }
}

export function isWorkflowContentionError(error: unknown): boolean {
  return error instanceof WorkflowAlreadyRunningError
    || (error instanceof Error && error.name === "WorkflowAlreadyRunningError");
}

export function isWorkflowLeaseLostError(error: unknown): boolean {
  return error instanceof WorkflowLeaseLostError
    || (error instanceof Error && error.name === "WorkflowLeaseLostError");
}

export function shouldMarkPipelineFailed(error: unknown): boolean {
  return !isWorkflowContentionError(error) && !isWorkflowLeaseLostError(error)
    && !(error instanceof WorkflowAwaitingApprovalError || (error instanceof Error && error.name === "WorkflowAwaitingApprovalError"));
}

/** Single create/resume path. Checkpoints decide which work is reused. */
export async function dispatchExplainerWorkflow(input: {
  pipelineId: string;
  userId: string;
  executionKey: string;
  checkpoints: WorkflowCheckpointPort;
  executor: WorkflowStageExecutor;
}): Promise<void> {
  return dispatchWorkflow({
    ...input,
    workflowVersion: EXPLAINER_WORKFLOW_VERSION,
    stages: EXPLAINER_STAGES,
  });
}

/** Shared durable dispatcher; each reel type supplies its own ordered stages. */
export async function dispatchWorkflow(input: {
  pipelineId: string;
  userId: string;
  executionKey: string;
  workflowVersion: number;
  stages: readonly WorkflowStage[];
  checkpoints: WorkflowCheckpointPort;
  executor: WorkflowStageExecutor;
}): Promise<void> {
  const completedOutputs = new Map<WorkflowStage, object | null>();
  for (const stage of input.stages) {
    const claim = await input.checkpoints.claim({
      pipelineId: input.pipelineId,
      userId: input.userId,
      workflowVersion: input.workflowVersion,
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
        workflowVersion: input.workflowVersion,
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
        workflowVersion: input.workflowVersion,
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
        workflowVersion: input.workflowVersion,
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
