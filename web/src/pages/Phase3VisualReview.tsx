import ReelScriptSection from "@/components/pipeline/ReelScriptSection";
import ReelTypeBadge from "@/components/pipeline/ReelTypeBadge";
import ReelVideoSpecSection from "@/components/pipeline/ReelVideoSpecSection";
import WorkflowProgress from "@/components/pipeline/WorkflowProgress";
import {
  listReviewProgress,
  listReviewScript,
  listReviewSpec,
  storyReviewProgress,
  storyReviewScript,
  storyReviewSpec,
} from "@/components/pipeline/phase3-visual-review.fixture";

export default function Phase3VisualReview() {
  return (
    <main className="min-h-screen bg-background p-6 text-foreground">
      <div className="mx-auto max-w-7xl space-y-8">
        <div><p className="text-xs uppercase tracking-[0.2em] text-muted-foreground">Development fixture</p><h1 className="text-3xl font-semibold">Phase 3 visual review</h1></div>
        <section className="space-y-5 rounded-xl border bg-card p-5">
          <ReelTypeBadge videoType="story" />
          <WorkflowProgress videoType="story" progress={storyReviewProgress} />
          <div className="grid gap-6 lg:grid-cols-2"><ReelScriptSection title="Fictional story" script={storyReviewScript} videoType="story" /><ReelVideoSpecSection spec={storyReviewSpec} videoType="story" /></div>
        </section>
        <section className="space-y-5 rounded-xl border bg-card p-5">
          <ReelTypeBadge videoType="list" />
          <WorkflowProgress videoType="list" progress={listReviewProgress} />
          <div className="grid gap-6 lg:grid-cols-2"><ReelScriptSection title="Countdown list" script={listReviewScript} videoType="list" /><ReelVideoSpecSection spec={listReviewSpec} videoType="list" /></div>
        </section>
      </div>
    </main>
  );
}
