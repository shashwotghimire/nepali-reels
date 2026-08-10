import { ReelPerformanceTable } from "./ReelPerformanceTable";
import { AnalyticsSummary } from "./AnalyticsSummary";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import type { AnalyticsRecord, ImproverOutput } from "@/types/api/analytics-api.types";

interface Props {
  data: AnalyticsRecord;
  suggestions: ImproverOutput;
}

export function AnalyticsOverview({ data, suggestions }: Props) {
  return (
    <div className="flex flex-col gap-4">
      <ReelPerformanceTable
        reels={data.report.reels}
        topPerformerId={data.report.top_performer_id}
      />
      <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
        {/* <div className="lg:col-span-2">
          <AnalyticsSummary summary={suggestions.summary} />
        </div> */}
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-base">Top Performers</CardTitle>
          </CardHeader>
          <CardContent>
            <ul className="space-y-2">
              {suggestions.bestTopics.map((t, i) => (
                <li key={i} className="text-sm">
                  <p className="font-medium">{t.title}</p>
                  <p className="text-xs text-muted-foreground">{t.summary}</p>
                </li>
              ))}
            </ul>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-base">Under Performers</CardTitle>
          </CardHeader>
          <CardContent>
            <ul className="space-y-2">
              {suggestions.worstTopics.map((t, i) => (
                <li key={i} className="text-sm">
                  <p className="font-medium">{t.title}</p>
                  <p className="text-xs text-muted-foreground">{t.summary}</p>
                </li>
              ))}
            </ul>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
