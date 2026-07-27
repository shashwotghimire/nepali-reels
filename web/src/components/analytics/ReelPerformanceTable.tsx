import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import type { AnalyticsReel } from "@/types/api/analytics-api.types";

interface Props {
  reels: AnalyticsReel[];
  topPerformerId: string;
}

export function ReelPerformanceTable({ reels, topPerformerId }: Props) {
  return (
    <Card>
      <CardHeader className="pb-2">
        <CardTitle className="text-base">Reel Performance</CardTitle>
      </CardHeader>
      <CardContent className="p-0">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b text-left text-xs text-muted-foreground">
              <th className="px-4 py-2 font-medium">Video</th>
              <th className="px-4 py-2 font-medium text-right">Views</th>
              <th className="px-4 py-2 font-medium text-right">Likes</th>
              <th className="px-4 py-2 font-medium text-right">Eng.</th>
            </tr>
          </thead>
          <tbody className="divide-y">
            {reels.map((reel) => (
              <tr
                key={reel.tiktokVideoId}
                className={reel.tiktokVideoId === topPerformerId ? "bg-green-500/5" : ""}
              >
                <td className="px-4 py-2 max-w-[200px] truncate">
                  {reel.video_description}
                  {reel.tiktokVideoId === topPerformerId && (
                    <span className="ml-1.5 text-xs text-green-600 font-medium">★</span>
                  )}
                </td>
                <td className="px-4 py-2 text-right text-muted-foreground">
                  {reel.view_count.toLocaleString()}
                </td>
                <td className="px-4 py-2 text-right text-muted-foreground">
                  {reel.like_count.toLocaleString()}
                </td>
                <td className="px-4 py-2 text-right text-muted-foreground">
                  {(reel.engagement_rate * 100).toFixed(1)}%
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </CardContent>
    </Card>
  );
}
