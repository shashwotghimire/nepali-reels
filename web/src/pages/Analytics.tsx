import { useGetLatestAnalytics } from "@/hooks/api/useAnalytics";
import { MetricCard } from "@/components/analytics/MetricCard";
import { AnalyticsOverview } from "@/components/analytics/AnalyticsOverview";
import { AnalyticsInsightsTabs } from "@/components/analytics/AnalyticsInsightsTabs";
import { AnalyticsSkeleton } from "@/components/analytics/AnalyticsSkeleton";

function SectionLabel({ children }: { children: React.ReactNode }) {
  return (
    <h2 className="text-xs font-semibold text-muted-foreground uppercase tracking-wide mb-3">
      {children}
    </h2>
  );
}

function Analytics() {
  const { data, isLoading, error } = useGetLatestAnalytics();

  return (
    <div className="p-6 max-w-6xl mx-auto space-y-8">
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
          <section>
            <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
              <MetricCard label="Avg Engagement" value={`${(data.report.avg_engagement_rate * 100).toFixed(1)}%`} />
              <MetricCard label="Reels Tracked" value={data.report.reels.length} />
              <MetricCard label="Report Date" value={new Date(data.fetchedAt).toLocaleDateString()} />
              <MetricCard label="Suggested Topics" value={data.suggestions.suggestedTopics.length} />
            </div>
          </section>

          <section>
            <SectionLabel>Performance Overview</SectionLabel>
            <AnalyticsOverview data={data} suggestions={data.suggestions} />
          </section>

          <section>
            <SectionLabel>Insights & Strategy</SectionLabel>
            <AnalyticsInsightsTabs suggestions={data.suggestions} />
          </section>
        </>
      )}
    </div>
  );
}

export default Analytics;
