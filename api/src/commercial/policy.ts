import { CLAUDE_MODELS, VIDEO_MODELS, type ClaudeModel, type VideoModel } from "../constants/constant";

/** Commercial definitions for future checkout and quota work. Nothing in this module enforces access. */
export type PlanId = "trial" | "creator" | "plus";
export type BillingInterval = "none" | "month";

export interface PlanEntitlement {
  readonly id: PlanId;
  /** NPR paisa. Null means the plan has no recurring price. */
  readonly priceNprMinor: number | null;
  readonly billingInterval: BillingInterval;
  readonly requiresVerifiedAccount: boolean;
  /** Trial is lifetime; paid plans reset each billing period. */
  readonly quotaPeriod: "lifetime" | "billing_period";
  readonly videosPerPeriod: number;
  readonly maxOutputDurationSeconds: number;
  readonly aiRevisionsPerVideo: number;
  readonly styleSlots: number;
  readonly thumbnailsPerVideo: number;
  readonly thumbnailRegenerationsPerVideo: number;
  readonly videoTypes: readonly ("explainer" | "story" | "list")[];
  readonly manualScriptEditing: boolean;
  readonly allSupportedVoices: boolean;
  readonly captionPresets: boolean;
  readonly channelOverlay: boolean;
  readonly support: "email" | "priority_email" | "none";
  readonly format: "explainer" | "standard";
}

export const PLAN_ENTITLEMENTS = {
  trial: {
    id: "trial", priceNprMinor: null, billingInterval: "none",
    requiresVerifiedAccount: true, quotaPeriod: "lifetime", videosPerPeriod: 1,
    maxOutputDurationSeconds: 30, aiRevisionsPerVideo: 1, styleSlots: 0,
    thumbnailsPerVideo: 0, thumbnailRegenerationsPerVideo: 0, format: "explainer",
    videoTypes: ["explainer"], manualScriptEditing: true, allSupportedVoices: false,
    captionPresets: false, channelOverlay: false, support: "none",
  },
  creator: {
    id: "creator", priceNprMinor: 149_900, billingInterval: "month",
    requiresVerifiedAccount: false, quotaPeriod: "billing_period", videosPerPeriod: 2,
    maxOutputDurationSeconds: 75, aiRevisionsPerVideo: 2, styleSlots: 1,
    thumbnailsPerVideo: 1, thumbnailRegenerationsPerVideo: 0, format: "standard",
    videoTypes: ["explainer", "story", "list"], manualScriptEditing: true,
    allSupportedVoices: true, captionPresets: true, channelOverlay: true, support: "email",
  },
  plus: {
    id: "plus", priceNprMinor: 349_900, billingInterval: "month",
    requiresVerifiedAccount: false, quotaPeriod: "billing_period", videosPerPeriod: 4,
    maxOutputDurationSeconds: 75, aiRevisionsPerVideo: 2, styleSlots: 3,
    thumbnailsPerVideo: 1, thumbnailRegenerationsPerVideo: 2, format: "standard",
    videoTypes: ["explainer", "story", "list"], manualScriptEditing: true,
    allSupportedVoices: true, captionPresets: true, channelOverlay: true, support: "priority_email",
  },
} as const satisfies Record<PlanId, PlanEntitlement>;

export interface StandardGenerationConfig {
  readonly scriptModel: ClaudeModel;
  readonly videoModel: VideoModel;
  readonly videoResolution: "480p";
  /** Provider-generated video audio; separately generated narration is still supported. */
  readonly videoNativeAudio: false;
  /** Planning ceiling across all submitted scenes, including replacement scenes. */
  readonly maxGeneratedVideoSeconds: number;
}

export const STANDARD_GENERATION = {
  scriptModel: CLAUDE_MODELS["Sonnet 4.5"],
  videoModel: VIDEO_MODELS["Seedance 1.5 Pro"],
  videoResolution: "480p",
  videoNativeAudio: false,
  maxGeneratedVideoSeconds: 90,
} as const satisfies StandardGenerationConfig;

export interface CostBudgetPolicy {
  /** Advisory only: no atomic reservation or hard provider pre-call stop exists yet. */
  readonly enforcement: "inactive";
  readonly currency: "NPR";
  readonly nprPerUsd: number;
  readonly perVideoTargetNpr: Readonly<Record<"creator" | "plus", number>>;
  readonly aggregatePlanningCeilings: {
    /** Across every LLM call for one video, including fact checks and AI revisions. */
    readonly llmInputTokens: number;
    readonly llmOutputTokens: number;
    /** Across all scene-generation requests, including retries and regenerations. */
    readonly generatedVideoSeconds: number;
  };
  readonly retryReserveFraction: number;
  readonly paymentFeeFraction: number;
  /** Work that must be metered before this becomes an enforceable cost budget. */
  readonly coveredWork: readonly (
    | "all_llm_calls"
    | "research_searches"
    | "ai_revisions"
    | "video_generation_and_regeneration"
    | "narration_and_alignment"
    | "thumbnails"
    | "provider_retries"
  )[];
}

/** Illustrative aggregate budget assumptions, not a hard cost guarantee or pre-call guard. */
export const COST_BUDGET_POLICY = {
  enforcement: "inactive",
  currency: "NPR",
  nprPerUsd: 160,
  perVideoTargetNpr: { creator: 375, plus: 425 },
  aggregatePlanningCeilings: {
    llmInputTokens: 60_000,
    llmOutputTokens: 20_000,
    generatedVideoSeconds: STANDARD_GENERATION.maxGeneratedVideoSeconds,
  },
  retryReserveFraction: 0.25,
  paymentFeeFraction: 0.05,
  coveredWork: [
    "all_llm_calls", "research_searches", "ai_revisions",
    "video_generation_and_regeneration", "narration_and_alignment",
    "thumbnails", "provider_retries",
  ],
} as const satisfies CostBudgetPolicy;
