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

export interface StoryInput {
  treatment: "factual" | "fictional";
}

export interface ListInput {
  itemCount: number;
  order: "ascending" | "descending";
}

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

export interface ExplainerScriptOutput {
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

export interface ExplainerVideoSpec {
  voiceoverText: string;
  scenes: Scene[];
  musicDirection: string;
  thumbnailText: string;
}

export interface StoryScriptOutput {
  treatment: "factual" | "fictional";
  disclosureNp: string;
  factualClaims: { claim: string; sourceBasis: string }[];
  characters: { id: string; nameNp: string; stableDescription: string }[];
  locations: { id: string; stableDescription: string }[];
  hookOptions: { text: string; style: "question" | "tension" | "surprise" }[];
  selectedHook: string;
  narrationNp: string;
  shotPlan: {
    index: number;
    durationSec: number;
    beat: "hook" | "setup" | "turn" | "climax" | "resolution";
    narrationNp: string;
    visual: string;
    cameraOrMotion: string;
    characterIds: string[];
    locationId: string;
    continuityNote: string;
  }[];
  captions: Caption[];
  titleOptions: string[];
  hashtags: string[];
  platformDescription: string;
  estDurationSec: number;
}

export interface StoryVideoSpec {
  treatment: "factual" | "fictional";
  voiceoverText: string;
  characterBible: { id: string; stableDescription: string }[];
  locationBible: { id: string; stableDescription: string }[];
  scenes: (Scene & {
    beat: "hook" | "setup" | "turn" | "climax" | "resolution";
    characterIds: string[];
    locationId: string;
    continuityFromPrevious: string;
  })[];
  musicDirection: string;
  thumbnailText: string;
}

export interface ListScriptOutput {
  order: "ascending" | "descending";
  itemCount: number;
  rankingBasis: string;
  hook: { narrationNp: string; durationSec: number };
  items: {
    number: number;
    labelNp: string;
    narrationNp: string;
    takeawayNp: string;
    visual: string;
    sourceBasis: string;
    durationSec: number;
  }[];
  closing: { narrationNp: string; durationSec: number };
  narrationNp: string;
  captions: Caption[];
  titleOptions: string[];
  hashtags: string[];
  platformDescription: string;
  estDurationSec: number;
}

export interface ListVideoSpec {
  order: "ascending" | "descending";
  voiceoverText: string;
  scenes: (Scene & {
    role: "hook" | "item" | "closing";
    itemNumber: number | null;
  })[];
  musicDirection: string;
  thumbnailText: string;
}

export type ScriptOutput = ExplainerScriptOutput | StoryScriptOutput | ListScriptOutput;
export type VideoSpec = ExplainerVideoSpec | StoryVideoSpec | ListVideoSpec;

export interface WorkflowProgressState {
  orderedStages: string[];
  currentStage: string | null;
  stages: { stage: string; status: "pending" | "running" | "succeeded" | "failed" }[];
}

interface ReelBase {
  id: string;
  userId: string;
  topic: string;
  claudeModel: ClaudeModel;
  videoModel: VideoModel;
  videoType: VideoType;
  workflowVersion: number;
  workflowProgress?: WorkflowProgressState;
  ttsVoice: TtsVoice;
  soundSpec: object | null;
  pipelineStatus: PipelineStatus;
  failureReason: string | null;
  s3key: string | null;
  videoDurationSec: number | null;
  videoUrl: string | null;
  costUsd: number | null;
  costEstimateIncomplete?: boolean;
  createdAt: string;
  updatedAt: string;
  scriptVersion: number;
  scriptRevisionCount: number;
  scriptApprovedAt: string | null;
  approvedScriptFingerprint: string | null;
  thumbnailUrl: string | null;
  thumbnailVersions: { version: number; url: string; artifactKey: string }[] | null;
  selectedThumbnailVersion: number | null;
  operationIssues?: { kind: "script_revision" | "thumbnail_regeneration"; idempotencyKey: string; status: "reserved" | "submitted" | "provider_succeeded" | "uncertain"; error: string | null; version?: number; scriptVersion?: number; instruction?: string | null }[];
}

export interface ExplainerReel extends ReelBase {
  videoType: "explainer";
  contentInput: { videoType: "explainer" };
  draftScript: ExplainerScriptOutput | null;
  finalScript: ExplainerScriptOutput | null;
  videoSpec: ExplainerVideoSpec | null;
}

export interface StoryReel extends ReelBase {
  videoType: "story";
  contentInput: { videoType: "story"; storyInput: StoryInput };
  draftScript: StoryScriptOutput | null;
  finalScript: StoryScriptOutput | null;
  videoSpec: StoryVideoSpec | null;
}

export interface ListReel extends ReelBase {
  videoType: "list";
  contentInput: { videoType: "list"; listInput: ListInput };
  draftScript: ListScriptOutput | null;
  finalScript: ListScriptOutput | null;
  videoSpec: ListVideoSpec | null;
}

export type Reel = ExplainerReel | StoryReel | ListReel;

export type ClaudeModel =
  | "global.anthropic.claude-haiku-4-5-20251001-v1:0"
  | "global.anthropic.claude-sonnet-4-5-20250929-v1:0"
  | "global.anthropic.claude-opus-4-5-20251101-v1:0"
  | "global.anthropic.claude-sonnet-4-6"
  | "global.anthropic.claude-opus-4-6-v1";

export type VideoModel =
  "bytedance/seedance-1-5-pro" | "alibaba/wan-2.6" | "x-ai/grok-imagine-video" | "bytedance/seedance-2.0-mini";

export type TtsVoice = "aoede" | "fenrir" | "puck" | "zephyr" | "kore" | "charon" | "callirrhoe";

interface GenerateScriptRequestBase {
  topic: string;
  model?: ClaudeModel;
  videoModel?: VideoModel;
  autoPublish?: boolean;
  ttsVoice?: TtsVoice;
  captionPreset?: "default" | "bold" | "minimal";
  styleId?: string;
}

export interface ChannelStyle { id: string; name: string; channelName: string; logoUrl: string | null; captionPreset: "default" | "bold" | "minimal"; }

export type GenerateScriptRequest =
  | (GenerateScriptRequestBase & { videoType?: "explainer" })
  | (GenerateScriptRequestBase & { videoType: "story"; storyInput: StoryInput })
  | (GenerateScriptRequestBase & { videoType: "list"; listInput: ListInput });

export interface GenerateScriptResponse {
  pipelineId: string;
  model: ClaudeModel;
  videoModel: VideoModel;
  videoType: VideoType;
  workflowVersion: number;
}

export interface GenerationEntitlements {
  accessKind: "verified_trial" | "subscription" | "legacy_compatibility";
  plan: {
    id: "trial" | "creator" | "plus" | "legacy_standard";
    aiRevisionsPerVideo: number;
    styleSlots: number;
    thumbnailRegenerationsPerVideo: number;
    allSupportedVoices: boolean;
    captionPresets: boolean;
    channelOverlay: boolean;
  };
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
