import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import type { AnalyticsReel } from "@/types/api/analytics-api.types";

interface Props {
  reels: AnalyticsReel[];
  topPerformerId: string;
}

export function ReelPerformanceTable({ reels, topPerformerId }: Props) {
  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-base">Reel Performance</CardTitle>
      </CardHeader>
      <CardContent className="divide-y">
        {reels.map((reel) => (
          <div key={reel.tiktokVideoId} className="flex items-center justify-between py-3 gap-4">
            <div className="flex items-center gap-2 min-w-0">
              <span className="text-sm truncate">{reel.video_description}</span>
              {reel.tiktokVideoId === topPerformerId && (
                <Badge variant="secondary" className="shrink-0">Top</Badge>
              )}
            </div>
            <div className="flex gap-6 text-sm shrink-0 text-muted-foreground">
              <span>{reel.view_count.toLocaleString()} views</span>
              <span>{(reel.engagement_rate * 100).toFixed(1)}% eng.</span>
            </div>
          </div>
        ))}
      </CardContent>
    </Card>
  );
}
