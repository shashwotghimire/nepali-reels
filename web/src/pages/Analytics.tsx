import { useGetLatestAnalytics } from "@/hooks/api/useAnalytics";
import { MetricCard } from "@/components/analytics/MetricCard";
import { AnalyticsSummary } from "@/components/analytics/AnalyticsSummary";
import { TopicsPerformance } from "@/components/analytics/TopicsPerformance";
import { HooksAndGaps } from "@/components/analytics/HooksAndGaps";
import { ReelPerformanceTable } from "@/components/analytics/ReelPerformanceTable";
import { SuggestedTopics } from "@/components/analytics/SuggestedTopics";
import { ExperimentsCard } from "@/components/analytics/ExperimentsCard";
import { AnalyticsSkeleton } from "@/components/analytics/AnalyticsSkeleton";

function Analytics() {
  const { data, isLoading, error } = useGetLatestAnalytics();

  return (
    <div className="p-6 max-w-4xl mx-auto space-y-8">
      <div>
        <h1 className="text-2xl font-semibold">Analytics</h1>
        <p className="text-muted-foreground text-sm mt-1">
          Weekly performance report generated every Monday.
        </p>
      </div>

      {isLoading && <AnalyticsSkeleton />}

      {error && (
        <p className="text-muted-foreground text-sm">
          No analytics report yet — check back after the next weekly run.
        </p>
      )}

      {data && Array.isArray(data.suggestions) && (
        <p className="text-muted-foreground text-sm">
          Report format is outdated — a fresh weekly run will update it.
        </p>
      )}

      {data && !Array.isArray(data.suggestions) && (
        <>
          <div className="grid grid-cols-2 gap-4 sm:grid-cols-4">
            <MetricCard label="Avg Engagement" value={`${(data.report.avg_engagement_rate * 100).toFixed(1)}%`} />
            <MetricCard label="Reels Tracked" value={data.report.reels.length} />
            <MetricCard label="Report Date" value={new Date(data.fetchedAt).toLocaleDateString()} />
            <MetricCard label="Suggested Topics" value={data.suggestions.suggestedTopics.length} />
          </div>

          <AnalyticsSummary summary={data.suggestions.summary} />
          <TopicsPerformance bestTopics={data.suggestions.bestTopics} worstTopics={data.suggestions.worstTopics} />
          <HooksAndGaps bestHooks={data.suggestions.bestHooks} contentGaps={data.suggestions.contentGaps} />
          <ReelPerformanceTable reels={data.report.reels} topPerformerId={data.report.top_performer_id} />
          <SuggestedTopics topics={data.suggestions.suggestedTopics} />
          <ExperimentsCard experiments={data.suggestions.experiments} />
        </>
      )}
    </div>
  );
}

export default Analytics;
