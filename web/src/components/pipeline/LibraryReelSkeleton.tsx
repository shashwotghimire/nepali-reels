import { Skeleton } from "@/components/ui/skeleton";

export default function LibraryReelSkeleton() {
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
