import { Card, CardContent } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";

export function AnalyticsSkeleton() {
  return (
    <div className="space-y-8">
      {/* KPI cards */}
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
        {Array.from({ length: 4 }).map((_, i) => (
          <Card key={i} className="border-t-2 border-t-muted">
            <CardContent className="pt-5 space-y-2">
              <Skeleton className="h-4 w-4 rounded" />
              <Skeleton className="h-3 w-24" />
              <Skeleton className="h-8 w-16" />
            </CardContent>
          </Card>
        ))}
      </div>
      {/* Performance overview */}
      <div>
        <Skeleton className="h-4 w-40 mb-3" />
        <div className="grid grid-cols-1 gap-4 lg:grid-cols-5">
          <div className="lg:col-span-3">
            <Skeleton className="h-64 w-full rounded-xl" />
          </div>
          <div className="lg:col-span-2 flex flex-col gap-4">
            <Skeleton className="h-28 w-full rounded-xl" />
            <Skeleton className="h-32 w-full rounded-xl" />
          </div>
        </div>
      </div>
      {/* Insights tabs */}
      <div>
        <Skeleton className="h-4 w-36 mb-3" />
        <Skeleton className="h-9 w-72 mb-4 rounded-md" />
        <Skeleton className="h-48 w-full rounded-xl" />
      </div>
    </div>
  );
}
