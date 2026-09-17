import { Button } from "@/components/ui/button";
import { useAbandonUncertainOperation } from "@/hooks/api/usePipeline";
import type { Reel } from "@/types/api/pipeline-api.types";

export default function OperationIssuePanel({ reel }: { reel: Reel }) {
  const abandon = useAbandonUncertainOperation(reel.id);
  if (!reel.operationIssues?.length) return null;
  return <section className="space-y-3 rounded-lg border border-destructive/40 bg-destructive/5 p-4">
    <h2 className="font-semibold">Provider result needs reconciliation</h2>
    <p className="text-sm text-muted-foreground">The provider may have accepted this request before the worker stopped. It will not be sent again automatically. Acknowledge it to continue; the entitlement remains consumed to avoid double charging.</p>
    {reel.operationIssues.map((issue) => <div key={`${issue.kind}:${issue.idempotencyKey}`} className="flex items-center justify-between gap-3 rounded border p-3 text-sm"><span>{issue.kind.replace(/_/g, " ")}{issue.version ? ` · version ${issue.version}` : ""}</span><Button size="sm" variant="destructive" disabled={abandon.isPending} onClick={() => abandon.mutate({ kind: issue.kind, key: issue.idempotencyKey })}>Acknowledge and continue</Button></div>)}
  </section>;
}
