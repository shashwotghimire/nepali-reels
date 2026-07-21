import type { PipelineStatus } from "@/types/api/pipeline-api.types";

export const PIPELINE_STATUS_VARIANT: Record<
  PipelineStatus,
  "default" | "secondary" | "destructive" | "outline"
> = {
  queued: "outline",
  script_generated: "secondary",
  script_finalised: "secondary",
  video_spec_generated: "default",
  sound_generated: "default",
  video_generated: "default",
  publish_pending: "secondary",
  published: "default",
  failed: "destructive",
};
