import { useRef, useState } from "react";
import { Hash, Play } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import type { Reel } from "@/types/api/pipeline-api.types";
import ReelTypeBadge from "./ReelTypeBadge";

export default function LibraryReelCard({ reel }: { reel: Reel }) {
  const hashtags = reel.finalScript?.hashtags ?? [];
  const [playing, setPlaying] = useState(false);
  const videoRef = useRef<HTMLVideoElement>(null);

  const handlePlayToggle = () => {
    if (!videoRef.current) return;
    if (playing) videoRef.current.pause();
    else void videoRef.current.play();
    setPlaying(!playing);
  };

  return (
    <div className="rounded-lg border bg-card overflow-hidden flex flex-col">
      <div className="relative aspect-[9/16] bg-muted flex items-center justify-center">
        {reel.videoUrl ? (
          <>
            <video
              ref={videoRef}
              src={reel.videoUrl}
              className="w-full h-full object-cover"
              onEnded={() => setPlaying(false)}
              playsInline
            />
            <button
              type="button"
              onClick={handlePlayToggle}
              aria-label={playing ? "Pause video" : "Play video"}
              className="absolute inset-0 flex items-center justify-center bg-black/20 opacity-0 hover:opacity-100 focus-visible:opacity-100 transition-opacity"
            >
              <span className="rounded-full bg-black/60 p-3">
                <Play className="size-6 text-white fill-white" />
              </span>
            </button>
          </>
        ) : (
          <div className="flex flex-col items-center gap-2 text-muted-foreground p-4 text-center">
            <Play className="size-8 opacity-30" />
            <span className="text-xs">Video not yet generated</span>
          </div>
        )}
      </div>
      <div className="p-3 flex flex-col gap-2 flex-1">
        <div><ReelTypeBadge videoType={reel.videoType} /></div>
        <p className="text-sm font-medium line-clamp-2">{reel.topic}</p>
        {hashtags.length > 0 && (
          <div className="flex flex-wrap gap-1">
            {hashtags.slice(0, 4).map((tag) => (
              <Badge key={tag} variant="secondary" className="text-xs px-1.5 py-0 gap-0.5">
                <Hash className="size-2.5" />
                {tag.replace(/^#/, "")}
              </Badge>
            ))}
            {hashtags.length > 4 && (
              <Badge variant="outline" className="text-xs px-1.5 py-0">+{hashtags.length - 4}</Badge>
            )}
          </div>
        )}
        <p className="text-xs text-muted-foreground mt-auto">
          {new Date(reel.createdAt).toLocaleDateString()}
        </p>
      </div>
    </div>
  );
}
