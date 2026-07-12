export interface TikTokUserProfile {
  open_id: string;
  avatar_url: string;
  display_name: string;
  username: string;
  follower_count: number;
  following_count: number;
  video_count: number;
  likes_count: number;
}

export interface UserTiktokConnectionDetailsResponse {
  connected: boolean;
  tiktokUserId: string | null;
  profile: TikTokUserProfile | null;
}
