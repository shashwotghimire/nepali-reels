import {
  ALIGNMENT_PRICING,
  IMAGE_PRICING,
  LLM_PRICING,
  TTS_PRICING,
  VIDEO_GENERATION_PRICING,
  type ClaudeModel,
  type VideoModel,
} from "../constants/constant";
import type { LlmUsage } from "../types/usage.types";

export const accumulateLlmUsage = (usages: LlmUsage[]): LlmUsage =>
  usages.reduce(
    (acc, u) => ({
      inputTokens: acc.inputTokens + u.inputTokens,
      outputTokens: acc.outputTokens + u.outputTokens,
      cacheWriteTokens: acc.cacheWriteTokens + u.cacheWriteTokens,
      cacheReadTokens: acc.cacheReadTokens + u.cacheReadTokens,
    }),
    { inputTokens: 0, outputTokens: 0, cacheWriteTokens: 0, cacheReadTokens: 0 },
  );

export const calculateLlmCost = (usage: LlmUsage, model: ClaudeModel): number => {
  const pricing = LLM_PRICING[model];
  if (!pricing) return 0;
  const perMillion = (tokens: number, rate: number) => (tokens / 1_000_000) * rate;
  return (
    perMillion(usage.inputTokens, pricing.input) +
    perMillion(usage.outputTokens, pricing.output) +
    perMillion(usage.cacheWriteTokens, pricing.cacheWrite) +
    perMillion(usage.cacheReadTokens, pricing.cacheRead)
  );
};

// Gemini audio output is billed separately from text input. Character count is
// not a substitute for either token count; an absent usage field stays unknown.
export const estimateTtsTokenCost = (
  inputTokens: number | null,
  outputAudioTokens: number | null,
  model: string,
): number | null => {
  const pricing = TTS_PRICING[model as keyof typeof TTS_PRICING];
  if (!pricing || inputTokens === null || outputAudioTokens === null) return null;
  return (inputTokens * pricing.input + outputAudioTokens * pricing.output) / 1_000_000;
};

export const calculateAlignmentCost = (audioMinutes: number): number =>
  audioMinutes * ALIGNMENT_PRICING.elevenlabs.perMinute;

export const calculateVideoCost = (seconds: number, model: VideoModel): number => {
  const pricing = VIDEO_GENERATION_PRICING[model];
  if (!pricing) return 0;
  return seconds * pricing.perSecond;
};

export const calculateImageCost = (widthPx: number, heightPx: number, model: string): number => {
  const pricing = IMAGE_PRICING[model as keyof typeof IMAGE_PRICING];
  if (!pricing) return 0;
  const megapixels = (widthPx * heightPx) / 1_000_000;
  return megapixels * pricing.perMegapixel;
};

export const estimateImageCost = (widthPx: number, heightPx: number, model: string): number | null => {
  if (!(model in IMAGE_PRICING)) return null;
  return calculateImageCost(widthPx, heightPx, model);
};

// Provider submissions use rounded clip seconds; final composition may trim them.
export const generatedClipSeconds = (scenes: ReadonlyArray<{ startSec: number; endSec: number }>): number =>
  scenes.reduce((total, scene) => total + Math.round(scene.endSec - scene.startSec), 0);

export const sumCosts = (...amounts: number[]): number =>
  amounts.reduce((acc, v) => acc + v, 0);
