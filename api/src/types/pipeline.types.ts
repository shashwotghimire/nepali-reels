export type PipelineStatus =
  | "queued"
  | "script_generated"
  | "script_finalised"
  | "video_spec_generated"
  | "sound_generated"
  | "video_generated"
  | "publish_pending"
  | "published"
  | "failed";
