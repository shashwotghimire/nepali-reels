export interface TikTokVideoInsight {
  video_id: string;
  video_description: string;
  create_time: number;
  view_count: number;
  like_count: number;
  comment_count: number;
  share_count: number;
  duration: number;
}

export interface AnalyticsReel {
  tiktokVideoId: string;
  video_description: string;
  view_count: number;
  like_count: number;
  comment_count: number;
  share_count: number;
  engagement_rate: number;
}

export interface AnalyticsReport {
  summary: string;
  reels: AnalyticsReel[];
  top_performer_id: string;
  avg_engagement_rate: number;
}

export interface SuggestedTopic {
  title: string;
  category: string;
  notes: string;
  rationale: string;
}

export interface Experiment {
  hypothesis: string;
  variable: string;
  how: string;
}

export interface ImproverOutput {
  bestTopics: { title: string; summary: string }[];
  worstTopics: { title: string; summary: string }[];
  bestHooks: string[];
  contentGaps: string[];
  suggestedTopics: SuggestedTopic[];
  experiments: Experiment[];
  summary: string;
}

export interface AnalyticsRecord {
  id: string;
  userId: string;
  rawData: TikTokVideoInsight[];
  report: AnalyticsReport;
  suggestions: ImproverOutput;
  fetchedAt: string;
  createdAt: string;
  updatedAt: string;
}
