import type { VideoType } from "@/types/api/pipeline-api.types";

const STAGE_LABELS: Record<string, string> = {
  script: "Draft explainer",
  fact_check: "Check facts",
  linguistic_review: "Polish Nepali",
  video_spec: "Design scenes",
  story_script: "Draft story",
  story_continuity: "Check continuity",
  story_fact_safety: "Review treatment and safety",
  story_video_spec: "Design continuous scenes",
  list_script: "Draft numbered list",
  list_structure: "Validate numbering",
  list_fact_check: "Check ranked claims",
  list_video_spec: "Design item scenes",
  audio: "Create narration",
  alignment: "Align captions",
  video: "Generate visuals",
  thumbnail: "Create thumbnail",
  render: "Compose reel",
  upload: "Store video",
  notify: "Notify creator",
  publish: "Publish",
};

export function getWorkflowStageLabel(stage: string, videoType: VideoType): string {
  if (STAGE_LABELS[stage]) return STAGE_LABELS[stage];
  return `${videoType} ${stage.replace(/_/g, " ")}`;
}
