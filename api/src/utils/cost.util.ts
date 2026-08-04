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

export const calculateTtsCost = (chars: number, model: string): number => {
  const pricing = TTS_PRICING[model as keyof typeof TTS_PRICING];
  if (!pricing) return 0;
  return (chars / 1_000_000) * pricing.input;
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

export const sumCosts = (...amounts: number[]): number =>
  amounts.reduce((acc, v) => acc + v, 0);
