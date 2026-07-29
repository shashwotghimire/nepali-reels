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
  tokenExpired: boolean;
  tiktokUserId: string | null;
  profile: TikTokUserProfile | null;
}

export interface TikTokCreatorInfo {
  creatorAvatarUrl: string;
  creatorUsername: string;
  creatorNickname: string;
  privacyLevelOptions: string[];
  commentDisabled: boolean;
  duetDisabled: boolean;
  stitchDisabled: boolean;
  maxVideoPostDurationSec: number;
}

export interface PublishToTiktokRequest {
  pipelineId: string;
  title: string;
  privacyLevel: string;
  disableComment: boolean;
  disableDuet: boolean;
  disableStitch: boolean;
  brandContentToggle: boolean;
  brandOrganicToggle: boolean;
  isAigc: boolean;
}

export interface PublishToTiktokResponse {
  publishId: string;
}
