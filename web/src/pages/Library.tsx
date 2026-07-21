import { useState, useRef } from "react";
import { useGetReelsOfUser } from "@/hooks/api/usePipeline";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { Search, ChevronLeft, ChevronRight, Play, Hash } from "lucide-react";
import type { Reel } from "@/types/api/pipeline-api.types";

const PAGE_SIZE = 12;

function ReelCard({ reel }: { reel: Reel }) {
  const hashtags = reel.finalScript?.hashtags ?? [];
  const [playing, setPlaying] = useState(false);
  const videoRef = useRef<HTMLVideoElement>(null);

  const handlePlayToggle = () => {
    if (!videoRef.current) return;
    if (playing) {
      videoRef.current.pause();
    } else {
      videoRef.current.play();
    }
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
              onClick={handlePlayToggle}
              className="absolute inset-0 flex items-center justify-center bg-black/20 opacity-0 hover:opacity-100 transition-opacity"
            >
              <div className="rounded-full bg-black/60 p-3">
                <Play className="size-6 text-white fill-white" />
              </div>
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
              <Badge variant="outline" className="text-xs px-1.5 py-0">
                +{hashtags.length - 4}
              </Badge>
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

function SkeletonCard() {
  return (
    <div className="rounded-lg border bg-card overflow-hidden flex flex-col">
      <Skeleton className="aspect-[9/16] w-full" />
      <div className="p-3 space-y-2">
        <Skeleton className="h-4 w-full" />
        <Skeleton className="h-3 w-2/3" />
      </div>
    </div>
  );
}

function Library() {
  const [searchInput, setSearchInput] = useState("");
  const [activeSearch, setActiveSearch] = useState<string | undefined>(undefined);
  const [page, setPage] = useState(1);

  const { data, isPending, isFetching } = useGetReelsOfUser({
    page,
    limit: PAGE_SIZE,
    search: activeSearch,
  });

  const handleSearch = () => {
    setPage(1);
    setActiveSearch(searchInput.trim() || undefined);
  };

  const handleKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === "Enter") handleSearch();
  };

  const handleClear = () => {
    setSearchInput("");
    setActiveSearch(undefined);
    setPage(1);
  };

  const reels = data?.reels ?? [];
  const totalPages = data?.totalPages ?? 1;
  const totalItems = data?.totalItems ?? 0;

  return (
    <div className="p-6 space-y-6">
      <div>
        <h1 className="text-2xl font-semibold mb-1">Library</h1>
        <p className="text-muted-foreground">Your generated reels.</p>
      </div>

      <div className="flex gap-2 max-w-sm">
        <div className="relative flex-1">
          <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 size-4 text-muted-foreground" />
          <Input
            className="pl-8"
            placeholder="Search by topic or hashtag…"
            value={searchInput}
            onChange={(e) => setSearchInput(e.target.value)}
            onKeyDown={handleKeyDown}
          />
        </div>
        <Button onClick={handleSearch} disabled={isFetching}>
          Search
        </Button>
        {activeSearch && (
          <Button variant="ghost" onClick={handleClear}>
            Clear
          </Button>
        )}
      </div>

      {activeSearch && (
        <p className="text-sm text-muted-foreground -mt-2">
          Results for &ldquo;{activeSearch}&rdquo; &mdash; {totalItems} reel{totalItems !== 1 ? "s" : ""}
        </p>
      )}

      {isPending ? (
        <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-6 gap-4">
          {Array.from({ length: PAGE_SIZE }).map((_, i) => (
            <SkeletonCard key={i} />
          ))}
        </div>
      ) : reels.length === 0 ? (
        <div className="py-16 text-center text-sm text-muted-foreground">
          {activeSearch
            ? `No reels found for "${activeSearch}".`
            : "No reels generated yet."}
        </div>
      ) : (
        <div className={`grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-6 gap-4 transition-opacity ${isFetching ? "opacity-60" : ""}`}>
          {reels.map((reel) => (
            <ReelCard key={reel.id} reel={reel} />
          ))}
        </div>
      )}

      {totalPages > 1 && (
        <div className="flex items-center justify-between pt-2">
          <p className="text-xs text-muted-foreground">
            Page {page} of {totalPages} &middot; {totalItems} reel{totalItems !== 1 ? "s" : ""}
          </p>
          <div className="flex gap-1">
            <Button
              variant="outline"
              size="sm"
              onClick={() => setPage((p) => p - 1)}
              disabled={page <= 1 || isFetching}
            >
              <ChevronLeft className="size-4" />
            </Button>
            <Button
              variant="outline"
              size="sm"
              onClick={() => setPage((p) => p + 1)}
              disabled={page >= totalPages || isFetching}
            >
              <ChevronRight className="size-4" />
            </Button>
          </div>
        </div>
      )}
    </div>
  );
}

export default Library;
