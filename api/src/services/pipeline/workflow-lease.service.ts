import type { WorkflowLeaseGuard } from "../../types/workflow-lease.types";

/** Check authority immediately before an external, non-transactional side effect. */
export async function runWithActiveStageLease<T>(
  lease: WorkflowLeaseGuard,
  sideEffect: () => Promise<T>,
): Promise<T> {
  await lease.assertOwned();
  return sideEffect();
}
