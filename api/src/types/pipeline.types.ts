export type PipelineStatus =
  | "queued"
  | "script_generated"
  | "script_finalised"
  | "linguistic_reviewed"
  | "awaiting_script_approval"
  | "video_spec_generated"
  | "sound_generated"
  | "video_generated"
  | "publish_pending"
  | "published"
  | "failed";

export type VideoType = "explainer" | "story" | "list";

export type StoryTreatment = "factual" | "fictional";

export type ListOrder = "ascending" | "descending";

export type CaptionPreset = "default" | "bold" | "minimal";

export interface ChannelStyleSnapshot {
  id?: string;
  name: string;
  channelName: string;
  logoUrl: string | null;
  captionPreset: CaptionPreset;
}

export type PipelineContentInput =
  | { videoType: "explainer" }
  | { videoType: "story"; storyInput: { treatment: StoryTreatment } }
  | { videoType: "list"; listInput: { itemCount: number; order: ListOrder } };
