import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import type { ImproverOutput } from "@/types/api/analytics-api.types";

interface Props {
  bestTopics: ImproverOutput["bestTopics"];
  worstTopics: ImproverOutput["worstTopics"];
}

export function TopicsPerformance({ bestTopics, worstTopics }: Props) {
  return (
    <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
      <Card>
        <CardHeader>
          <CardTitle className="text-base">Top Performers</CardTitle>
        </CardHeader>
        <CardContent className="space-y-3">
          {bestTopics.map((t, i) => (
            <div key={i}>
              <p className="text-sm font-medium">{t.title}</p>
              <p className="text-xs text-muted-foreground">{t.summary}</p>
            </div>
          ))}
        </CardContent>
      </Card>
      <Card>
        <CardHeader>
          <CardTitle className="text-base">Under Performers</CardTitle>
        </CardHeader>
        <CardContent className="space-y-3">
          {worstTopics.map((t, i) => (
            <div key={i}>
              <p className="text-sm font-medium">{t.title}</p>
              <p className="text-xs text-muted-foreground">{t.summary}</p>
            </div>
          ))}
        </CardContent>
      </Card>
    </div>
  );
}
