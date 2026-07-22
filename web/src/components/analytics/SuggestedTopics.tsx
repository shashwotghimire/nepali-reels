import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import type { SuggestedTopic } from "@/types/api/analytics-api.types";

interface Props {
  topics: SuggestedTopic[];
}

export function SuggestedTopics({ topics }: Props) {
  return (
    <div className="space-y-3">
      <h2 className="text-base font-semibold">Suggested Topics</h2>
      {topics.map((topic, i) => (
        <Card key={i}>
          <CardContent className="pt-6 space-y-2">
            <div className="flex items-start justify-between gap-4">
              <p className="font-medium">{topic.title}</p>
              <Badge variant="outline" className="shrink-0">{topic.category}</Badge>
            </div>
            <p className="text-sm text-muted-foreground">{topic.rationale}</p>
            {topic.notes && (
              <p className="text-xs text-muted-foreground italic">{topic.notes}</p>
            )}
          </CardContent>
        </Card>
      ))}
    </div>
  );
}
