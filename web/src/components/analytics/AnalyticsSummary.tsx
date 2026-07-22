import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";

interface Props {
  summary: string;
}

export function AnalyticsSummary({ summary }: Props) {
  // Split on sentence-ending punctuation but not on decimals (e.g. 10.48%)
  const sentences = summary.split(/(?<=[^0-9])[.!?]\s+(?=[A-Z])/).filter(Boolean);

  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-base">Summary</CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        {sentences.map((s, i) => (
          <p key={i} className="text-sm leading-7 text-foreground/70">
            {s.trim()}
          </p>
        ))}
      </CardContent>
    </Card>
  );
}
