import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import type { ImproverOutput } from "@/types/api/analytics-api.types";

interface Props {
  bestTopics: ImproverOutput["bestTopics"];
  worstTopics: ImproverOutput["worstTopics"];
}

export function TopicsPerformance({ bestTopics, worstTopics }: Props) {
  return (
    <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
      <Card>
        <CardHeader className="pb-2">
          <CardTitle className="text-base">Top Performers</CardTitle>
        </CardHeader>
        <CardContent>
          <ul className="space-y-2">
            {bestTopics.map((t, i) => (
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
            {worstTopics.map((t, i) => (
              <li key={i} className="text-sm">
                <p className="font-medium">{t.title}</p>
                <p className="text-xs text-muted-foreground">{t.summary}</p>
              </li>
            ))}
          </ul>
        </CardContent>
      </Card>
    </div>
  );
}
