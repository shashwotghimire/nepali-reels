import { Button } from "@/components/ui/button";
import { useGenerationEntitlements, useRegenerateThumbnail, useSelectThumbnail } from "@/hooks/api/usePipeline";
import type { Reel } from "@/types/api/pipeline-api.types";

export default function ThumbnailVersions({ reel }: { reel: Reel }) {
  const versions = reel.thumbnailVersions ?? [];
  const { data: access } = useGenerationEntitlements();
  const regenerate = useRegenerateThumbnail(reel.id);
  const select = useSelectThumbnail(reel.id);
  if (versions.length === 0) return null;
  const limit = access?.plan.thumbnailRegenerationsPerVideo ?? 0;
  return <section className="space-y-3">
    <div className="flex items-center justify-between"><h2 className="font-semibold">Thumbnail versions</h2>
      {limit > 0 && <Button size="sm" variant="outline" disabled={regenerate.isPending || versions.length - 1 >= limit} onClick={() => regenerate.mutate(undefined)}>Regenerate ({versions.length - 1}/{limit})</Button>}
    </div>
    <div className="grid grid-cols-3 gap-2">{versions.map((item) => <button key={item.version} className={`overflow-hidden rounded border-2 ${item.version === reel.selectedThumbnailVersion ? "border-primary" : "border-transparent"}`} onClick={() => select.mutate(item.version)} disabled={select.isPending}>
      <img src={item.url} alt={`Thumbnail version ${item.version}`} className="aspect-9/16 w-full object-cover" /><span className="block p-1 text-xs">Version {item.version}</span>
    </button>)}</div>
  </section>;
}
