import type { PipelineStatus } from "../types/pipeline.types";

export const EXPLAINER_WORKFLOW_VERSION = 1 as const;
export const STORY_WORKFLOW_VERSION = 1 as const;
export const LIST_WORKFLOW_VERSION = 1 as const;

export const EXPLAINER_STAGES = [
  "script",
  "fact_check",
  "linguistic_review",
  "video_spec",
  "audio",
  "alignment",
  "video",
  "thumbnail",
  "render",
  "upload",
  "notify",
  "publish",
] as const;

export type ExplainerStage = (typeof EXPLAINER_STAGES)[number];

export const STORY_STAGES = [
  "story_script",
  "story_continuity",
  "story_fact_safety",
  "story_video_spec",
  "audio",
  "alignment",
  "video",
  "thumbnail",
  "render",
  "upload",
  "notify",
  "publish",
] as const;

export const LIST_STAGES = [
  "list_script",
  "list_structure",
  "list_fact_check",
  "list_video_spec",
  "audio",
  "alignment",
  "video",
  "thumbnail",
  "render",
  "upload",
  "notify",
  "publish",
] as const;

export type StoryStage = (typeof STORY_STAGES)[number];
export type ListStage = (typeof LIST_STAGES)[number];
export type WorkflowStage = ExplainerStage | StoryStage | ListStage;

export const WORKFLOW_STAGES_BY_TYPE = {
  explainer: EXPLAINER_STAGES,
  story: STORY_STAGES,
  list: LIST_STAGES,
} as const;

export interface LegacyPipelineProgress {
  pipelineStatus: PipelineStatus;
  draftScript: object | null;
  finalScript: object | null;
  videoSpec: object | null;
  soundSpec: object | null;
  s3key: string | null;
  thumbnailUrl?: string | null;
  tiktokPublishId?: string | null;
}

/** Derive only stages proven complete by legacy durable fields. */
export function inferLegacyCompletedStages(
  pipeline: LegacyPipelineProgress,
): ExplainerStage[] {
  const completed: ExplainerStage[] = [];
  if (pipeline.draftScript) completed.push("script");
  if (pipeline.finalScript) completed.push("fact_check");
  // finalScript is saved by fact checking before linguistic review runs. A
  // later durable result or the explicit legacy status is required proof.
  if (
    pipeline.videoSpec ||
    ["linguistic_reviewed", "video_spec_generated", "sound_generated", "video_generated", "publish_pending", "published"]
      .includes(pipeline.pipelineStatus)
  ) completed.push("linguistic_review");
  if (pipeline.videoSpec) completed.push("video_spec");
  const soundSpec = pipeline.soundSpec as { artifactKey?: string } | null;
  if (soundSpec?.artifactKey || pipeline.s3key) completed.push("audio");
  if (pipeline.s3key) {
    completed.push("alignment", "video", "render", "upload");
  }
  if (pipeline.thumbnailUrl) completed.push("thumbnail");
  if (pipeline.tiktokPublishId) completed.push("publish");
  return EXPLAINER_STAGES.filter((stage) => completed.includes(stage));
}

export function assertDeliveredDuration(
  durationSeconds: number,
  maximumSeconds: number,
): void {
  if (!Number.isFinite(durationSeconds) || durationSeconds < 0) {
    throw new Error("Delivered video duration must be a finite non-negative number");
  }
  if (durationSeconds > maximumSeconds) {
    throw new Error(
      `Delivered video duration ${durationSeconds.toFixed(3)}s exceeds ${maximumSeconds}s limit`,
    );
  }
}
