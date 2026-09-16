export interface WorkflowLeaseWriteFence {
  stageAttemptId: string;
  leaseOwner: string;
}

export interface WorkflowLeaseGuard extends WorkflowLeaseWriteFence {
  assertOwned(): Promise<void>;
}

export const WORKFLOW_LEASE_LOST_MESSAGE =
  "Workflow stage attempt is not owned by this worker";

export class WorkflowLeaseLostError extends Error {
  constructor() {
    super(WORKFLOW_LEASE_LOST_MESSAGE);
    this.name = "WorkflowLeaseLostError";
  }
}
