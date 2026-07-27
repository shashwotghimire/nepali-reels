import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";

interface Props {
  summary: string;
}

export function AnalyticsSummary({ summary }: Props) {
  return (
    <Card>
      <CardHeader className="pb-2">
        <CardTitle className="text-base">Summary</CardTitle>
      </CardHeader>
      <CardContent>
        <p className="text-sm leading-6 text-foreground/80">{summary}</p>
      </CardContent>
    </Card>
  );
}
