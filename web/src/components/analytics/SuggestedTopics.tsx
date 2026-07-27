import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import type { SuggestedTopic } from "@/types/api/analytics-api.types";

interface Props {
  topics: SuggestedTopic[];
}

export function SuggestedTopics({ topics }: Props) {
  return (
    <Card>
      <CardHeader className="pb-2">
        <CardTitle className="text-base">Suggested Topics</CardTitle>
      </CardHeader>
      <CardContent className="divide-y">
        {topics.map((topic, i) => (
          <div key={i} className="py-2.5 first:pt-0 last:pb-0">
            <div className="flex items-center gap-2">
              <p className="text-sm font-medium">{topic.title}</p>
              <Badge variant="outline" className="text-xs px-1.5 py-0">{topic.category}</Badge>
            </div>
            <p className="text-xs text-muted-foreground mt-0.5">{topic.rationale}</p>
            {topic.notes && (
              <p className="text-xs text-muted-foreground/70 italic mt-0.5">{topic.notes}</p>
            )}
          </div>
        ))}
      </CardContent>
    </Card>
  );
}
