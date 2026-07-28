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

export type TiktokWebhookEvent =
  | "post.publish.failed"
  | "post.publish.complete"
  | "post.publish.inbox_delivered"
  | "post.publish.publicly_available"
  | "post.publish.no_longer_publicaly_available";

export interface TiktokWebhookPayload {
  event: TiktokWebhookEvent;
  publish_id: string;
  post_id?: string;
  publish_type?: string;
  reason?: string;
}
