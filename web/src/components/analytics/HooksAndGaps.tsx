import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";

interface Props {
  bestHooks: string[];
  contentGaps: string[];
}

export function HooksAndGaps({ bestHooks, contentGaps }: Props) {
  return (
    <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
      <Card>
        <CardHeader className="pb-2">
          <CardTitle className="text-base">Best Hooks</CardTitle>
        </CardHeader>
        <CardContent>
          <ul className="space-y-1.5">
            {bestHooks.map((h, i) => (
              <li key={i} className="text-sm text-foreground/80 flex gap-2">
                <span className="text-green-500 shrink-0">•</span>
                {h}
              </li>
            ))}
          </ul>
        </CardContent>
      </Card>
      <Card>
        <CardHeader className="pb-2">
          <CardTitle className="text-base">Content Gaps</CardTitle>
        </CardHeader>
        <CardContent>
          <ul className="space-y-1.5">
            {contentGaps.map((g, i) => (
              <li key={i} className="text-sm text-foreground/80 flex gap-2">
                <span className="text-orange-500 shrink-0">•</span>
                {g}
              </li>
            ))}
          </ul>
        </CardContent>
      </Card>
    </div>
  );
}
