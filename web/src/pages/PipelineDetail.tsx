import { useParams, useNavigate } from "react-router-dom";
import { useGetPipelineById, useRetryPipeline } from "@/hooks/api/usePipeline";
import { usePublishToTiktok, useGetCreatorInfo } from "@/hooks/api/useTiktok";
import { Spinner } from "@/components/ui/spinner";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { PIPELINE_STATUS_VARIANT } from "@/types/ui/pipeline.types";
import {
  getPipelineAudioUrl,
  getPipelineVideoUrl,
} from "@/services/pipeline.service";
import TikTokPublishForm from "@/components/tiktok/TikTokPublishForm";
import ReelScriptSection from "@/components/pipeline/ReelScriptSection";
import ReelVideoSpecSection from "@/components/pipeline/ReelVideoSpecSection";
import ReelTypeBadge from "@/components/pipeline/ReelTypeBadge";
import WorkflowProgress from "@/components/pipeline/WorkflowProgress";
import ScriptApprovalPanel from "@/components/pipeline/ScriptApprovalPanel";
import ThumbnailVersions from "@/components/pipeline/ThumbnailVersions";

export default function PipelineDetail() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const { data, isPending, error } = useGetPipelineById(id!);
  const { mutate: publishToTiktok, isPending: isPublishing } = usePublishToTiktok(id!);
  const { mutate: retryPipeline, isPending: isRetrying } = useRetryPipeline(id!);

  const canShowPublishForm =
    !!data &&
    (data.pipelineStatus === "video_generated" || data.pipelineStatus === "publish_pending") &&
    !!data.s3key;
  const { data: creatorInfo, isPending: isLoadingCreatorInfo } = useGetCreatorInfo(canShowPublishForm);

  if (isPending) {
    return (
      <div className="flex items-center justify-center py-12">
        <Spinner className="size-6" />
      </div>
    );
  }

  if (error || !data) {
    return (
      <div className="p-6 space-y-4">
        <Button variant="outline" size="sm" onClick={() => navigate(-1)}>
          ← Back
        </Button>
        <p className="text-sm text-destructive">Failed to load pipeline.</p>
      </div>
    );
  }

  return (
    <div className="p-6 space-y-6">
      <div className="flex items-start gap-4">
        <Button variant="outline" size="sm" onClick={() => navigate(-1)}>
          ← Back
        </Button>
        <div className="flex-1 min-w-0">
          <h1 className="text-2xl font-semibold truncate">{data.topic}</h1>
          <p className="text-xs text-muted-foreground mt-0.5">
            {new Date(data.createdAt).toLocaleString()}
          </p>
          <div className="mt-2"><ReelTypeBadge videoType={data.videoType} /></div>
        </div>
        <div className="flex flex-col items-end gap-1">
          <Badge variant={PIPELINE_STATUS_VARIANT[data.pipelineStatus]}>
            {data.pipelineStatus.replace(/_/g, " ")}
          </Badge>
          {data.costUsd != null && (
            <p className="text-xs text-muted-foreground tabular-nums">
              Known estimated cost: ${data.costUsd.toFixed(4)}{data.costEstimateIncomplete !== false ? " (partial)" : ""}
            </p>
          )}
        </div>
      </div>

      {data.pipelineStatus === "failed" && (
        <div className="rounded-md border border-destructive/50 bg-destructive/10 px-4 py-3 text-sm text-destructive flex items-center justify-between gap-4">
          <div>
            <span className="font-semibold">Error: </span>
            {data.failureReason ?? "Pipeline failed. No additional details available."}
          </div>
          <Button
            variant="destructive"
            size="sm"
            onClick={() => retryPipeline()}
            disabled={isRetrying}
          >
            {isRetrying ? "Retrying…" : "Retry"}
          </Button>
        </div>
      )}

      {data.workflowProgress && (
        <WorkflowProgress videoType={data.videoType} progress={data.workflowProgress} />
      )}

      {data.pipelineStatus === "awaiting_script_approval" && data.finalScript && (
        <ScriptApprovalPanel key={data.scriptVersion} reel={data} />
      )}

      <div className="grid gap-6 items-start lg:grid-cols-2">
        <div className="space-y-8">
          {data.draftScript && (
            <ReelScriptSection title="Draft script" script={data.draftScript} videoType={data.videoType} />
          )}
          {data.finalScript && (
            <ReelScriptSection title="Final script" script={data.finalScript} videoType={data.videoType} />
          )}
          {data.videoSpec && <ReelVideoSpecSection spec={data.videoSpec} videoType={data.videoType} />}
        </div>

        <div className="space-y-6 sticky top-6 max-h-[calc(100vh-9rem)] overflow-y-auto">
          <ThumbnailVersions reel={data} />
          {data.pipelineStatus === "sound_generated" && (
            <section className="space-y-2">
              <h2 className="text-base font-semibold">Audio</h2>
              <audio
                controls
                src={getPipelineAudioUrl(data.id)}
                crossOrigin="use-credentials"
                className="w-full"
              />
            </section>
          )}
          {(data.pipelineStatus === "video_generated" ||
            data.pipelineStatus === "publish_pending" ||
            data.pipelineStatus === "published") && (
            <section className="space-y-2">
              <h2 className="text-base font-semibold">Video</h2>
              <video
                controls
                src={getPipelineVideoUrl(data.id)}
                className="w-full max-w-xs rounded-lg aspect-9/16 bg-black"
              />
              {canShowPublishForm && data.pipelineStatus === "publish_pending" && (
                <div className="flex items-center gap-2 text-sm text-muted-foreground">
                  <Spinner className="size-4" />
                  Publishing to TikTok…
                </div>
              )}
              {canShowPublishForm && data.pipelineStatus === "video_generated" && (
                isLoadingCreatorInfo ? (
                  <div className="flex items-center gap-2 text-sm text-muted-foreground">
                    <Spinner className="size-4" />
                    Loading TikTok info…
                  </div>
                ) : creatorInfo ? (
                  <TikTokPublishForm
                    creatorInfo={creatorInfo}
                    videoDurationSec={data.videoDurationSec}
                    initialCaption={(() => {
                      const script = data.finalScript ?? data.draftScript;
                      const title = script?.titleOptions[0] ?? data.topic;
                      const hashtags = script?.hashtags
                        ?.map((h) => (h.startsWith("#") ? h : `#${h}`))
                        .join(" ") ?? "";
                      return hashtags ? `${title} ${hashtags}` : title;
                    })()}
                    isPublishing={isPublishing}
                    onPublish={(fields) =>
                      publishToTiktok({
                        pipelineId: data.id,
                        ...fields,
                      })
                    }
                  />
                ) : (
                  <p className="text-xs text-destructive">
                    Failed to load TikTok creator info. Please try refreshing.
                  </p>
                )
              )}
{data.pipelineStatus === "published" && (
                <p className="text-xs text-muted-foreground text-center">Published to TikTok</p>
              )}
            </section>
          )}
        </div>
      </div>
    </div>
  );
}
