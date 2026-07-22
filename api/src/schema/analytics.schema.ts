import { z } from "zod";

export const AnalyticsReelSchema = z.object({
  tiktokVideoId: z.string(),
  video_description: z.string(),
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

export const SuggestedTopicSchema = z.object({
  title: z.string(),
  category: z.string(),
  notes: z.string(),
  rationale: z.string(),
});

export const ExperimentSchema = z.object({
  hypothesis: z.string(),
  variable: z.string(),
  how: z.string(),
});

export const ImproverOutputSchema = z.object({
  bestTopics: z.array(z.object({ title: z.string(), summary: z.string() })).min(1),
  worstTopics: z.array(z.object({ title: z.string(), summary: z.string() })),
  bestHooks: z.array(z.string()),
  contentGaps: z.array(z.string()),
  suggestedTopics: z.array(SuggestedTopicSchema).min(2).max(10),
  experiments: z.array(ExperimentSchema).min(2).max(4),
  summary: z.string(),
});

export type AnalyticsReport = z.infer<typeof AnalyticsReportSchema>;
export type SuggestedTopic = z.infer<typeof SuggestedTopicSchema>;
export type Experiment = z.infer<typeof ExperimentSchema>;
export type ImproverOutput = z.infer<typeof ImproverOutputSchema>;

// Legacy — kept for backwards compat with existing DB rows
export const SuggestionSchema = z.object({
  topic: z.string(),
  reasoning: z.string(),
  score: z.number().int().min(1).max(10),
});
export const SuggestionsSchema = z.array(SuggestionSchema).min(2).max(3);
export type Suggestion = z.infer<typeof SuggestionSchema>;
export type Suggestions = z.infer<typeof SuggestionsSchema>;
