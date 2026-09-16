import type { Reel, VideoSpec } from "@/types/api/pipeline-api.types";

export default function ReelVideoSpecSection({
  spec,
  videoType,
}: {
  spec: VideoSpec;
  videoType: Reel["videoType"];
}) {
  return (
    <section className="space-y-4">
      <h2 className="text-base font-semibold">Video spec</h2>
      <div className="rounded-lg border divide-y">
        <div className="p-4">
          <p className="text-xs text-muted-foreground uppercase tracking-wide">Voiceover</p>
          <p className="text-sm leading-relaxed mt-1">{spec.voiceoverText}</p>
        </div>
        <div className="p-4 grid gap-3 sm:grid-cols-2">
          <div><p className="text-xs text-muted-foreground">Thumbnail</p><p className="text-sm">{spec.thumbnailText}</p></div>
          <div><p className="text-xs text-muted-foreground">Music</p><p className="text-sm">{spec.musicDirection}</p></div>
        </div>
        <div className="p-4 space-y-3">
          <p className="text-xs text-muted-foreground uppercase tracking-wide">{videoType === "list" ? "Numbered scenes" : videoType === "story" ? "Continuity scenes" : "Scenes"}</p>
          {spec.scenes.map((scene, index) => (
            <div key={`${scene.startSec}-${scene.endSec}`} className="space-y-1">
              <p className="text-xs text-muted-foreground tabular-nums">
                {"itemNumber" in scene && scene.itemNumber != null ? `#${scene.itemNumber} · ` : ""}
                {scene.startSec}s–{scene.endSec}s
              </p>
              <p className="text-sm">{scene.bgPrompt}</p>
              <p className="text-xs text-muted-foreground">“{scene.captionText}”{scene.onScreenText ? ` · ${scene.onScreenText}` : ""}</p>
              {"continuityFromPrevious" in scene && index > 0 && (
                <p className="text-xs text-muted-foreground">Continuity: {scene.continuityFromPrevious}</p>
              )}
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}
