import { useState } from "react";
import { useGetReelsOfUser } from "@/hooks/api/usePipeline";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Search, ChevronLeft, ChevronRight } from "lucide-react";
import LibraryReelCard from "@/components/pipeline/LibraryReelCard";
import LibraryReelSkeleton from "@/components/pipeline/LibraryReelSkeleton";

const PAGE_SIZE = 12;

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
            <LibraryReelSkeleton key={i} />
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
            <LibraryReelCard key={reel.id} reel={reel} />
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
