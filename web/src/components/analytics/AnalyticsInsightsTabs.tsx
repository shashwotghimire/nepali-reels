import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { SuggestedTopics } from "./SuggestedTopics";
import { HooksAndGaps } from "./HooksAndGaps";
import { ExperimentsCard } from "./ExperimentsCard";
import type { ImproverOutput } from "@/types/api/analytics-api.types";

interface Props {
  suggestions: ImproverOutput;
}

export function AnalyticsInsightsTabs({ suggestions }: Props) {
  return (
    <Tabs defaultValue="topics" className="flex-col">
      <TabsList className="mb-4">
        <TabsTrigger value="topics">
          Topics ({suggestions.suggestedTopics.length})
        </TabsTrigger>
        <TabsTrigger value="strategy">Strategy</TabsTrigger>
        <TabsTrigger value="experiments">
          Experiments ({suggestions.experiments.length})
        </TabsTrigger>
      </TabsList>
      <TabsContent value="topics">
        <SuggestedTopics topics={suggestions.suggestedTopics} />
      </TabsContent>
      <TabsContent value="strategy">
        <HooksAndGaps bestHooks={suggestions.bestHooks} contentGaps={suggestions.contentGaps} />
      </TabsContent>
      <TabsContent value="experiments">
        <ExperimentsCard experiments={suggestions.experiments} />
      </TabsContent>
    </Tabs>
  );
}
