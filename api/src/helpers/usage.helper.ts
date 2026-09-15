import type { LlmUsage } from "../types/usage.types";

export interface AnthropicUsageResponse {
  usage: {
    input_tokens: number;
    output_tokens: number;
    cache_creation_input_tokens?: number | null;
    cache_read_input_tokens?: number | null;
  };
}

export const extractLlmUsage = (response: AnthropicUsageResponse): LlmUsage => ({
  inputTokens: response.usage.input_tokens,
  outputTokens: response.usage.output_tokens,
  cacheWriteTokens: response.usage.cache_creation_input_tokens ?? 0,
  cacheReadTokens: response.usage.cache_read_input_tokens ?? 0,
});

export interface TtsUsage {
  inputTokens: number | null;
  cacheReadTokens: number | null;
  outputAudioTokens: number | null;
}

export function extractTtsUsage(response: unknown): TtsUsage {
  const value = response as {
    usage?: {
      total_input_tokens?: number;
      total_cached_tokens?: number;
      output_tokens_by_modality?: Array<{ modality?: string; tokens?: unknown }>;
    };
  };
  const usage = value.usage;
  const audio = usage?.output_tokens_by_modality?.filter(
    (part) => part.modality?.toLowerCase() === "audio",
  );
  const validAudioTokens = audio?.every(
    (part) =>
      typeof part.tokens === "number" &&
      Number.isFinite(part.tokens) &&
      part.tokens >= 0,
  );
  const outputAudioTokens = audio?.length && validAudioTokens
    ? audio.reduce((sum, part) => sum + (part.tokens as number), 0)
    : null;
  return {
    inputTokens: usage?.total_input_tokens ?? null,
    cacheReadTokens: usage?.total_cached_tokens ?? null,
    outputAudioTokens,
  };
}
