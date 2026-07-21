import { useParams, useNavigate } from "react-router-dom";
import { useGetPipelineById } from "@/hooks/api/usePipeline";
import { usePublishToTiktok } from "@/hooks/api/useTiktok";
import { Spinner } from "@/components/ui/spinner";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { PIPELINE_STATUS_VARIANT } from "@/types/ui/pipeline.types";
import {
  getPipelineAudioUrl,
  getPipelineVideoUrl,
} from "@/services/pipeline.service";
import TikTokIcon from "@/components/connections/TikTokIcon";
import type { ScriptOutput, VideoSpec } from "@/types/api/pipeline-api.types";

function ScriptSection({
  title,
  script,
}: {
  title: string;
  script: ScriptOutput;
}) {
  return (
    <section className="space-y-4">
      <h2 className="text-base font-semibold">{title}</h2>
      <div className="rounded-lg border divide-y">
        <div className="p-4 space-y-1">
          <p className="text-xs text-muted-foreground uppercase tracking-wide">
            Title options
          </p>
          <ul className="space-y-1">
            {script.titleOptions.map((t, i) => (
              <li key={i} className="text-sm">
                {t}
              </li>
            ))}
          </ul>
        </div>

        <div className="p-4 space-y-1">
          <p className="text-xs text-muted-foreground uppercase tracking-wide">
            Hook
          </p>
          <p className="text-sm">{script.selectedHook}</p>
        </div>

        <div className="p-4 space-y-1">
          <p className="text-xs text-muted-foreground uppercase tracking-wide">
            Narration
          </p>
          <p className="text-sm leading-relaxed">{script.narrationNp}</p>
        </div>

        <div className="p-4 space-y-1">
          <p className="text-xs text-muted-foreground uppercase tracking-wide">
            Description
          </p>
          <p className="text-sm leading-relaxed">
            {script.platformDescription}
          </p>
        </div>

        <div className="p-4 space-y-2">
          <p className="text-xs text-muted-foreground uppercase tracking-wide">
            Shot plan
          </p>
          <div className="space-y-2">
            {script.shotPlan.map((shot) => (
              <div key={shot.index} className="flex gap-3 text-sm">
                <span className="text-muted-foreground w-5 shrink-0">
                  {shot.index}.
                </span>
                <div className="space-y-0.5">
                  <p>{shot.visual}</p>
                  <p className="text-xs text-muted-foreground">
                    {shot.cameraOrMotion} · {shot.durationSec}s
                  </p>
                </div>
              </div>
            ))}
          </div>
        </div>

        <div className="p-4 space-y-2">
          <p className="text-xs text-muted-foreground uppercase tracking-wide">
            Captions
          </p>
          <div className="space-y-1">
            {script.captions.map((c, i) => (
              <div key={i} className="flex gap-3 text-sm">
                <span className="text-muted-foreground shrink-0 tabular-nums">
                  {c.startSec}s–{c.endSec}s
                </span>
                <span>{c.text}</span>
              </div>
            ))}
          </div>
        </div>

        {script.onScreenText.length > 0 && (
          <div className="p-4 space-y-2">
            <p className="text-xs text-muted-foreground uppercase tracking-wide">
              On-screen text
            </p>
            <div className="space-y-1">
              {script.onScreenText.map((o, i) => (
                <div key={i} className="flex gap-3 text-sm">
                  <span className="text-muted-foreground shrink-0 tabular-nums">
                    {o.atSec}s
                  </span>
                  <span>{o.text}</span>
                </div>
              ))}
            </div>
          </div>
        )}

        <div className="p-4 space-y-2">
          <p className="text-xs text-muted-foreground uppercase tracking-wide">
            Hashtags
          </p>
          <div className="flex flex-wrap gap-1.5">
            {script.hashtags.map((tag, i) => (
              <Badge
                key={i}
                variant="secondary"
                className="text-xs font-normal"
              >
                {tag}
              </Badge>
            ))}
          </div>
        </div>

        <div className="p-4">
          <p className="text-xs text-muted-foreground">
            Estimated duration: {script.estDurationSec}s
          </p>
        </div>
      </div>
    </section>
  );
}

function VideoSpecSection({ spec }: { spec: VideoSpec }) {
  return (
    <section className="space-y-4">
      <h2 className="text-base font-semibold">Video spec</h2>
      <div className="rounded-lg border divide-y">
        <div className="p-4 space-y-1">
          <p className="text-xs text-muted-foreground uppercase tracking-wide">
            Voiceover
          </p>
          <p className="text-sm leading-relaxed">{spec.voiceoverText}</p>
        </div>

        <div className="p-4 space-y-1">
          <p className="text-xs text-muted-foreground uppercase tracking-wide">
            Thumbnail text
          </p>
          <p className="text-sm">{spec.thumbnailText}</p>
        </div>

        <div className="p-4 space-y-1">
          <p className="text-xs text-muted-foreground uppercase tracking-wide">
            Music direction
          </p>
          <p className="text-sm">{spec.musicDirection}</p>
        </div>

        <div className="p-4 space-y-2">
          <p className="text-xs text-muted-foreground uppercase tracking-wide">
            Scenes
          </p>
          <div className="space-y-3">
            {spec.scenes.map((scene, i) => (
              <div key={i} className="space-y-1">
                <p className="text-xs text-muted-foreground tabular-nums">
                  {scene.startSec}s–{scene.endSec}s
                </p>
                <p className="text-sm">{scene.bgPrompt}</p>
                <p className="text-xs text-muted-foreground">
                  "{scene.captionText}"
                  {scene.onScreenText && ` · ${scene.onScreenText}`}
                </p>
              </div>
            ))}
          </div>
        </div>
      </div>
    </section>
  );
}

export default function PipelineDetail() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const { data, isPending, error } = useGetPipelineById(id!);
  const { mutate: publishToTiktok, isPending: isPublishing } = usePublishToTiktok(id!);

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
        </div>
        <Badge variant={PIPELINE_STATUS_VARIANT[data.pipelineStatus]}>
          {data.pipelineStatus.replace(/_/g, " ")}
        </Badge>
      </div>

      <div className="grid grid-cols-2 gap-6 items-start">
        <div className="space-y-8">
          {data.draftScript && (
            <ScriptSection title="Draft script" script={data.draftScript} />
          )}
          {data.finalScript && (
            <ScriptSection title="Final script" script={data.finalScript} />
          )}
          {data.videoSpec && <VideoSpecSection spec={data.videoSpec} />}
        </div>

        <div className="space-y-6 sticky top-6 max-h-[calc(100vh-6rem)] overflow-y-auto">
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
              {(data.pipelineStatus === "video_generated" || data.pipelineStatus === "publish_pending") && data.s3key && (
                <Button
                  className="w-full"
                  disabled={isPublishing || data.pipelineStatus === "publish_pending"}
                  onClick={() =>
                    publishToTiktok({
                      pipelineId: data.id,
                      videoUrl: `https://${import.meta.env.VITE_CDN_DOMAIN}/${data.s3key}`,
                      title:
                        data.finalScript?.titleOptions[0] ??
                        data.draftScript?.titleOptions[0] ??
                        data.topic,
                    })
                  }
                >
                  {(isPublishing || data.pipelineStatus === "publish_pending") ? (
                    <Spinner className="size-4 mr-2" />
                  ) : (
                    <TikTokIcon />
                  )}
                  {(isPublishing || data.pipelineStatus === "publish_pending") ? "Publishing to TikTok…" : "Publish to TikTok"}
                </Button>
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
