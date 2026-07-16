import { useParams, useNavigate } from "react-router-dom";
import { useGetPipelineById } from "@/hooks/api/usePipeline";
import { Spinner } from "@/components/ui/spinner";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { PIPELINE_STATUS_VARIANT } from "@/types/ui/pipeline.types";
import { getPipelineAudioUrl } from "@/services/pipeline.service";

export default function PipelineDetail() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const { data, isPending, error } = useGetPipelineById(id!);

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
      <div className="flex items-center gap-4">
        <Button variant="outline" size="sm" onClick={() => navigate(-1)}>
          ← Back
        </Button>
        <div>
          <h1 className="text-2xl font-semibold">{data.topic}</h1>
          <p className="text-xs text-muted-foreground mt-0.5">
            {new Date(data.createdAt).toLocaleString()}
          </p>
        </div>
        <Badge
          variant={PIPELINE_STATUS_VARIANT[data.pipelineStatus]}
          className="ml-auto"
        >
          {data.pipelineStatus.replace(/_/g, " ")}
        </Badge>
      </div>
      {data.pipelineStatus === "sound_generated" && (
        <div className="space-y-1">
          <p className="text-sm font-medium">Audio</p>
          <audio controls src={getPipelineAudioUrl(data.id)} crossOrigin="use-credentials" className="w-full" />
        </div>
      )}
      <div>
        <p>Draft script:</p>
        <div>Title options:{data.draftScript.titleOptions[0]}</div>
        <p>Hook:{data.draftScript.selectedHook}</p>
        <p>narration text: {data.draftScript.narrationNp}</p>
        <p>hash tags: {data.draftScript.hashtags}</p>
      </div>
      <div>
        <p>Final script:</p>
        <div>Title options:{data.finalScript.titleOptions[0]}</div>
        <p>Hook:{data.finalScript.selectedHook}</p>
        <p>narration text: {data.finalScript.narrationNp}</p>
        <p>hash tags: {data.finalScript.hashtags}</p>
      </div>
    </div>
  );
}
