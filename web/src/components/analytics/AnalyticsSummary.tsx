import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import Markdown from "react-markdown";

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
        <Markdown>{summary}</Markdown>
      </CardContent>
    </Card>
  );
}
