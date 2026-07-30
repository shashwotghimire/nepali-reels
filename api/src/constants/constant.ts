export const STATE_COOKIE = "tiktok_oauth_state" as const;

export const VIDEO_W = 720;
export const VIDEO_H = 1280;
export const SUBTITLE_FONT_SIZE = 72;
export const SUBTITLE_FONT = `bold ${SUBTITLE_FONT_SIZE}px "Noto Sans Devanagari", "Noto Sans", sans-serif`;
export const SUBTITLE_MAX_LINE_W = VIDEO_W * 0.85;
export const SUBTITLE_LINE_HEIGHT = SUBTITLE_FONT_SIZE * 1.25;
export const SUBTITLE_BOTTOM_MARGIN = 300;
export const SUBTITLE_OUTLINE_WIDTH = 8;
export const SUBTITLE_TEXT_COLOR = "#FFE600";
export const SUBTITLE_OUTLINE_COLOR = "#000000";
export const FACT_CHECK_RUNS = 15 as const;

export const ALIGNMENT_WORDS_PER_LINE = 6;
export const ALIGNMENT_MAX_LINE_SECONDS = 4.0;

export const CLAUDE_MODELS = {
  "Haiku 4.5": "global.anthropic.claude-haiku-4-5-20251001-v1:0",
  "Sonnet 4.5": "global.anthropic.claude-sonnet-4-5-20250929-v1:0",
  "Opus 4.5": "global.anthropic.claude-opus-4-5-20251101-v1:0",
  "Opus 4.6": "global.anthropic.claude-opus-4-6-v1",
} as const;

export type ClaudeModel = (typeof CLAUDE_MODELS)[keyof typeof CLAUDE_MODELS];

export const AI_VIDEO_POLL_INTERVAL_MS = 5_000;
export const AI_VIDEO_POLL_TIMEOUT_MS = 10 * 60 * 1_000;
export const AI_VIDEO_MIN_SCENE_DURATION = 4;
export const AI_VIDEO_MAX_SCENE_DURATION = 11;
export const AI_VIDEO_MIN_TOTAL_DURATION = 50;
export const AI_VIDEO_MAX_TOTAL_DURATION = 70;
// Thumbnail prepends 1s; composite output must stay within this ceiling to keep final ≤ 70s
export const AI_VIDEO_MAX_COMPOSITE_DURATION = 69;
export const AI_VIDEO_SCENE_CONTIGUITY_TOLERANCE = 0.05;
export const AI_VIDEO_DURATION_TOLERANCE = 0.25;
