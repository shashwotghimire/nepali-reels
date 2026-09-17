import { useState } from "react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Input } from "@/components/ui/input";
import { useApproveScript, useEditScript, useGenerationEntitlements, useReviseScript } from "@/hooks/api/usePipeline";
import type { Reel } from "@/types/api/pipeline-api.types";

export default function ScriptApprovalPanel({ reel }: { reel: Reel }) {
  const [json, setJson] = useState(JSON.stringify(reel.finalScript, null, 2));
  const [instruction, setInstruction] = useState("");
  const { data: access } = useGenerationEntitlements();
  const edit = useEditScript(reel.id);
  const revise = useReviseScript(reel.id);
  const approve = useApproveScript(reel.id);
  const busy = edit.isPending || revise.isPending || approve.isPending;

  return <section className="space-y-3 rounded-lg border border-amber-500/40 bg-amber-500/5 p-4">
    <div>
      <h2 className="font-semibold">Review and approve script</h2>
      <p className="text-sm text-muted-foreground">Production is paused. Edit the structured script, request an AI revision, or approve version {reel.scriptVersion}.</p>
    </div>
    <Textarea value={json} onChange={(event) => setJson(event.target.value)} className="min-h-72 font-mono text-xs" disabled={busy} />
    <div className="flex flex-wrap gap-2">
      <Button variant="outline" disabled={busy} onClick={() => {
        try { edit.mutate({ expectedVersion: reel.scriptVersion, script: JSON.parse(json) }, { onSuccess: () => toast.success("Script saved"), onError: () => toast.error("Could not save this script") }); }
        catch { toast.error("Script must be valid JSON"); }
      }}>Save edit</Button>
      <Input className="min-w-64 flex-1" placeholder="What should the AI improve?" value={instruction} onChange={(event) => setInstruction(event.target.value)} disabled={busy} />
      <Button variant="outline" disabled={busy || instruction.trim().length < 3 || reel.scriptRevisionCount >= (access?.plan.aiRevisionsPerVideo ?? 0)} onClick={() => revise.mutate({ expectedVersion: reel.scriptVersion, instruction }, { onSuccess: () => { setInstruction(""); toast.success("Revision ready for review"); }, onError: () => toast.error("AI revision failed") })}>
        Revise with AI ({reel.scriptRevisionCount}/{access?.plan.aiRevisionsPerVideo ?? "–"})
      </Button>
      <Button disabled={busy} onClick={() => approve.mutate(reel.scriptVersion, { onSuccess: () => toast.success("Approved. Production is resuming."), onError: () => toast.error("Approval failed; refresh and try again") })}>Approve and resume</Button>
    </div>
  </section>;
}
