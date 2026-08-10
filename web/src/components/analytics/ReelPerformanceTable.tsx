import { useState } from "react";
import { BarChart, Bar, XAxis, YAxis, Cell, Tooltip } from "recharts";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { ChartContainer, ChartTooltipContent } from "@/components/ui/chart";
import { Button } from "@/components/ui/button";
import { ChevronLeft, ChevronRight } from "lucide-react";
import type { AnalyticsReel } from "@/types/api/analytics-api.types";

const PAGE_SIZE = 5;

interface Props {
  reels: AnalyticsReel[];
  topPerformerId: string;
}

export function ReelPerformanceTable({ reels, topPerformerId }: Props) {
  const [page, setPage] = useState(0);
  const totalPages = Math.ceil(reels.length / PAGE_SIZE);
  const pageReels = reels.slice(page * PAGE_SIZE, (page + 1) * PAGE_SIZE);

  const chartData = pageReels.map((reel, i) => ({
    name:
      reel.video_description.length > 28
        ? reel.video_description.slice(0, 28) + "…"
        : reel.video_description,
    engagement: parseFloat((reel.engagement_rate * 100).toFixed(2)),
    views: reel.view_count,
    likes: reel.like_count,
    isTop: reel.tiktokVideoId === topPerformerId,
    rank: page * PAGE_SIZE + i + 1,
  }));

  const chartConfig = {
    engagement: { label: "Engagement" },
  };

  return (
    <Card>
      <CardHeader className="pb-2 border-b border-border">
        <div className="flex items-center justify-between">
          <CardTitle className="text-base">Reel Performance</CardTitle>
          <span className="text-xs text-muted-foreground tabular-nums">
            {reels.length} reels
          </span>
        </div>
      </CardHeader>
      <CardContent className="pt-4">
        <ChartContainer config={chartConfig} className="h-[280px] w-full">
          <BarChart
            data={chartData}
            layout="vertical"
            margin={{ top: 0, right: 48, bottom: 0, left: 8 }}
            barSize={20}
          >
            <XAxis
              type="number"
              tickFormatter={(v) => `${v}%`}
              tick={{ fontSize: 11 }}
              tickLine={false}
              axisLine={false}
              domain={[0, "auto"]}
            />
            <YAxis
              type="category"
              dataKey="name"
              width={160}
              tick={{ fontSize: 11 }}
              tickLine={false}
              axisLine={false}
            />
            <Tooltip
              content={
                <ChartTooltipContent
                  formatter={(value, _name, props) => {
                    const d = props.payload;
                    return [
                      <span key="tip" className="flex flex-col gap-0.5 text-xs">
                        <span className="font-semibold">{value}% engagement</span>
                        <span className="text-muted-foreground">
                          {d.views?.toLocaleString()} views · {d.likes?.toLocaleString()} likes
                        </span>
                      </span>,
                      "",
                    ];
                  }}
                />
              }
              cursor={{ fill: "var(--muted)", opacity: 0.5 }}
            />
            <Bar dataKey="engagement" radius={[0, 3, 3, 0]}>
              {chartData.map((entry) => (
                <Cell
                  key={entry.rank}
                  fill={entry.isTop ? "var(--primary)" : "var(--muted-foreground)"}
                  fillOpacity={entry.isTop ? 1 : 0.35}
                />
              ))}
            </Bar>
          </BarChart>
        </ChartContainer>

        {totalPages > 1 && (
          <div className="flex items-center justify-between mt-2 pt-2 border-t border-border">
            <span className="text-xs text-muted-foreground tabular-nums">
              {page * PAGE_SIZE + 1}–{Math.min((page + 1) * PAGE_SIZE, reels.length)} of {reels.length}
            </span>
            <div className="flex gap-1">
              <Button
                variant="ghost"
                size="icon"
                className="h-7 w-7"
                onClick={() => setPage((p) => p - 1)}
                disabled={page === 0}
              >
                <ChevronLeft className="w-4 h-4" />
              </Button>
              <Button
                variant="ghost"
                size="icon"
                className="h-7 w-7"
                onClick={() => setPage((p) => p + 1)}
                disabled={page === totalPages - 1}
              >
                <ChevronRight className="w-4 h-4" />
              </Button>
            </div>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
