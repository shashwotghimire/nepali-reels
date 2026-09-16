import { Badge } from "@/components/ui/badge";
import type { Reel, ScriptOutput } from "@/types/api/pipeline-api.types";

export default function ReelScriptSection({
  title,
  script,
  videoType,
}: {
  title: string;
  script: ScriptOutput;
  videoType: Reel["videoType"];
}) {
  return (
    <section className="space-y-4">
      <h2 className="text-base font-semibold">{title}</h2>
      <div className="rounded-lg border divide-y">
        <div className="p-4 space-y-1">
          <p className="text-xs text-muted-foreground uppercase tracking-wide">Narration</p>
          <p className="text-sm leading-relaxed">{script.narrationNp}</p>
        </div>
        {videoType === "story" && "treatment" in script && (
          <div className="p-4 space-y-2">
            <p className="text-xs text-muted-foreground uppercase tracking-wide">
              {script.treatment === "factual" ? "Factual treatment" : "Fictional treatment"}
            </p>
            <p className="text-sm">{script.disclosureNp}</p>
            <p className="text-xs text-muted-foreground">
              {script.characters.length} recurring character{script.characters.length === 1 ? "" : "s"} · {script.locations.length} location{script.locations.length === 1 ? "" : "s"}
            </p>
          </div>
        )}
        {videoType === "list" && "items" in script && (
          <div className="p-4 space-y-3">
            <p className="text-xs text-muted-foreground uppercase tracking-wide">
              {script.order === "descending" ? "Countdown" : "Ascending list"} · {script.rankingBasis}
            </p>
            {script.items.map((item) => (
              <div key={item.number} className="rounded-md bg-muted/50 p-3">
                <p className="text-sm font-medium">{item.number}. {item.labelNp}</p>
                <p className="text-sm text-muted-foreground mt-1">{item.narrationNp}</p>
              </div>
            ))}
          </div>
        )}
        {videoType !== "list" && "shotPlan" in script && (
          <div className="p-4 space-y-2">
            <p className="text-xs text-muted-foreground uppercase tracking-wide">Shot plan</p>
            {script.shotPlan.map((shot) => (
              <div key={shot.index} className="flex gap-3 text-sm">
                <span className="text-muted-foreground w-5 shrink-0">{shot.index}.</span>
                <div>
                  <p>{shot.visual}</p>
                  <p className="text-xs text-muted-foreground">{shot.cameraOrMotion} · {shot.durationSec}s</p>
                </div>
              </div>
            ))}
          </div>
        )}
        <div className="p-4 space-y-2">
          <p className="text-xs text-muted-foreground uppercase tracking-wide">Titles</p>
          {script.titleOptions.map((option) => <p key={option} className="text-sm">{option}</p>)}
        </div>
        <div className="p-4 flex flex-wrap gap-1.5">
          {script.hashtags.map((tag) => (
            <Badge key={tag} variant="secondary" className="text-xs font-normal">{tag}</Badge>
          ))}
        </div>
        <p className="p-4 text-xs text-muted-foreground">Estimated duration: {script.estDurationSec}s</p>
      </div>
    </section>
  );
}
