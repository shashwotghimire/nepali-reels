import { z } from "zod";

export const AnalyticsReelSchema = z.object({
  tiktokVideoId: z.string(),
  view_count: z.number(),
  like_count: z.number(),
  comment_count: z.number(),
  share_count: z.number(),
  engagement_rate: z.number(), // (likes+comments+shares) / views
});

export const AnalyticsReportSchema = z.object({
  summary: z.string(),
  reels: z.array(AnalyticsReelSchema),
  top_performer_id: z.string(),
  avg_engagement_rate: z.number(),
});

export const SuggestionSchema = z.object({
  topic: z.string(),
  reasoning: z.string(),
  score: z.number().int().min(1).max(10),
});

export const SuggestionsSchema = z.array(SuggestionSchema).min(2).max(3);

export type AnalyticsReport = z.infer<typeof AnalyticsReportSchema>;
export type Suggestion = z.infer<typeof SuggestionSchema>;
export type Suggestions = z.infer<typeof SuggestionsSchema>;
