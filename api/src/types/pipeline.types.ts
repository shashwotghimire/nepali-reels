export type PipelineStatus =
  | "queued"
  | "script_generated"
  | "script_finalised"
  | "linguistic_reviewed"
  | "video_spec_generated"
  | "sound_generated"
  | "video_generated"
  | "publish_pending"
  | "published"
  | "failed";

export type VideoType = "explainer" | "story" | "list";

export type StoryTreatment = "factual" | "fictional";

export type ListOrder = "ascending" | "descending";

export type PipelineContentInput =
  | { videoType: "explainer" }
  | { videoType: "story"; storyInput: { treatment: StoryTreatment } }
  | { videoType: "list"; listInput: { itemCount: number; order: ListOrder } };
