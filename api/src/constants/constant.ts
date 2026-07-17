export const STATE_COOKIE = "tiktok_oauth_state" as const;
export const FACT_CHECK_RUNS = 10 as const;

export const CLAUDE_MODELS = {
  "Haiku 4.5": "global.anthropic.claude-haiku-4-5-20251001-v1:0",
  "Sonnet 4.5": "global.anthropic.claude-sonnet-4-5-20250929-v1:0",
  "Opus 4.5": "global.anthropic.claude-opus-4-5-20251101-v1:0",
} as const;

export type ClaudeModel = (typeof CLAUDE_MODELS)[keyof typeof CLAUDE_MODELS];
