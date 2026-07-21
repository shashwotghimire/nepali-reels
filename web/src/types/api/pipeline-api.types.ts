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

interface HookOption {
  text: string;
  style:
    | "question"
    | "shock"
    | "curiosity_gap"
    | "relatable"
    | "bold_claim"
    | "story";
}

interface ShotPlan {
  index: number;
  durationSec: number;
  visual: string;
  cameraOrMotion: string;
}

interface Caption {
  startSec: number;
  endSec: number;
  text: string;
}

interface OnScreenText {
  atSec: number;
  text: string;
}

export interface ScriptOutput {
  hookOptions: HookOption[];
  selectedHook: string;
  narrationNp: string;
  shotPlan: ShotPlan[];
  onScreenText: OnScreenText[];
  captions: Caption[];
  titleOptions: string[];
  hashtags: string[];
  platformDescription: string;
  estDurationSec: number;
}

export interface Scene {
  startSec: number;
  endSec: number;
  bgPrompt: string;
  captionText: string;
  onScreenText?: string;
}

export interface VideoSpec {
  voiceoverText: string;
  scenes: Scene[];
  musicDirection: string;
  thumbnailText: string;
}

export interface Reel {
  id: string;
  userId: string;
  topic: string;
  claudeModel: ClaudeModel;
  draftScript: ScriptOutput | null;
  finalScript: ScriptOutput | null;
  videoSpec: VideoSpec | null;
  soundSpec: object | null;
  pipelineStatus: PipelineStatus;
  s3key: string | null;
  videoUrl: string | null;
  createdAt: string;
  updatedAt: string;
}

export type ClaudeModel =
  | "global.anthropic.claude-haiku-4-5-20251001-v1:0"
  | "global.anthropic.claude-sonnet-4-5-20250929-v1:0"
  | "global.anthropic.claude-opus-4-5-20251101-v1:0";

export interface GenerateScriptRequest {
  topic: string;
  model?: ClaudeModel;
}

export interface GenerateScriptResponse {
  pipelineId: string;
  model: ClaudeModel;
}

export interface GetReelsParams {
  page?: number;
  limit?: number;
  search?: string;
}

export interface GetReelsResponse {
  reels: Reel[];
  totalItems: number;
  totalPages: number;
  currentPage: number;
}
