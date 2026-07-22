import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";

interface Props {
  bestHooks: string[];
  contentGaps: string[];
}

export function HooksAndGaps({ bestHooks, contentGaps }: Props) {
  return (
    <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
      <Card>
        <CardHeader>
          <CardTitle className="text-base">Best Hooks</CardTitle>
        </CardHeader>
        <CardContent className="flex flex-wrap gap-2">
          {bestHooks.map((h, i) => (
            <Badge key={i} variant="secondary">{h}</Badge>
          ))}
        </CardContent>
      </Card>
      <Card>
        <CardHeader>
          <CardTitle className="text-base">Content Gaps</CardTitle>
        </CardHeader>
        <CardContent className="flex flex-wrap gap-2">
          {contentGaps.map((g, i) => (
            <Badge key={i} variant="outline">{g}</Badge>
          ))}
        </CardContent>
      </Card>
    </div>
  );
}
