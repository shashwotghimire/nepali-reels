import { Button } from "@/components/ui/button";
import { useAbandonUncertainOperation, useRegenerateThumbnail, useReviseScript } from "@/hooks/api/usePipeline";
import type { Reel } from "@/types/api/pipeline-api.types";

export default function OperationIssuePanel({ reel }: { reel: Reel }) {
  const abandon = useAbandonUncertainOperation(reel.id);
  const revise = useReviseScript(reel.id);
  const regenerate = useRegenerateThumbnail(reel.id);
  if (!reel.operationIssues?.length) return null;
  return <section className="space-y-3 rounded-lg border border-destructive/40 bg-destructive/5 p-4">
    <h2 className="font-semibold">Provider result needs reconciliation</h2>
    <p className="text-sm text-muted-foreground">Safe saved work can be resumed without another provider call. An uncertain provider submission cannot be resent; acknowledge it only when you want to abandon that result and continue.</p>
    {reel.operationIssues.map((issue) => {
      const resumable = issue.status === "reserved" || issue.status === "provider_succeeded";
      const resume = () => issue.kind === "script_revision"
        ? revise.mutate({ expectedVersion: issue.scriptVersion!, instruction: issue.instruction!, idempotencyKey: issue.idempotencyKey })
        : regenerate.mutate(issue.idempotencyKey);
      return <div key={`${issue.kind}:${issue.idempotencyKey}`} className="flex items-center justify-between gap-3 rounded border p-3 text-sm"><span>{issue.kind.replace(/_/g, " ")}{issue.version ? ` · version ${issue.version}` : ""} · {issue.status.replace(/_/g, " ")}</span>{resumable ? <Button size="sm" disabled={revise.isPending || regenerate.isPending} onClick={resume}>Resume safely</Button> : <Button size="sm" variant="destructive" disabled={abandon.isPending} onClick={() => abandon.mutate({ kind: issue.kind, key: issue.idempotencyKey })}>Acknowledge and continue</Button>}</div>;
    })}
  </section>;
}
