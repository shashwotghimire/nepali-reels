import { Badge } from "@/components/ui/badge";
import type { VideoType } from "@/types/api/pipeline-api.types";
import { VIDEO_TYPE_OPTIONS } from "./video-type-options";

export default function ReelTypeBadge({ videoType }: { videoType: VideoType }) {
  const option = VIDEO_TYPE_OPTIONS.find((candidate) => candidate.value === videoType);
  const Icon = option?.icon;

  return (
    <Badge variant="outline" className="gap-1 font-normal">
      {Icon && <Icon className="size-3" aria-hidden="true" />}
      {option?.label ?? videoType}
    </Badge>
  );
}
