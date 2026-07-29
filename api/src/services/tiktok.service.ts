import { generateToken } from "../helpers/crypto.helper";
import {
  createTiktokConnection,
  deleteTiktokConnection,
  getUserTiktokConnectionDetails,
  getUserTiktokTokens,
  updateTiktokTokens,
} from "../repositories/tiktok.repository";
import { findPipelineById, publishToTiktok } from "../repositories/reels.repository";
import { ApiError } from "../utils/ApiError.util";
import { enqueueTiktokStatusPoll } from "../queue/tiktok.queue";

export const buildAuthUrl = () => {
  const state = generateToken();
  const url = new URL("https://www.tiktok.com/v2/auth/authorize/");
  url.searchParams.set("client_key", process.env.TIKTOK_CLIENT_KEY!);
  url.searchParams.set(
    "scope",
    "user.info.basic,user.info.profile,video.publish", // user.info.stats excluded until real analytics are implemented
  );
  url.searchParams.set("response_type", "code");
  url.searchParams.set("redirect_uri", process.env.TIKTOK_REDIRECT_URI!);
  url.searchParams.set("state", state);
  return { url: url.toString(), state };
};

const fetchTiktokProfile = async (accessToken: string) => {
  const res = await fetch(
    "https://open.tiktokapis.com/v2/user/info/?fields=open_id,avatar_url,display_name,username,follower_count,following_count,video_count,likes_count",
    { headers: { Authorization: `Bearer ${accessToken}` } },
  );
  const data = await res.json();
  if (data.error?.code !== "ok")
    throw new ApiError(
      400,
      `TikTok API error: ${data.error?.message}`,
      "TIKTOK_API_ERROR",
    );
  return data.data.user;
};

const REFRESH_BUFFER_MS = 5 * 60 * 1000; // refresh 5 min before expiry

const refreshAccessToken = async (userId: string, refreshToken: string): Promise<string> => {
  const res = await fetch("https://open.tiktokapis.com/v2/oauth/token/", {
    method: "POST",
    headers: {
      "Content-Type": "application/x-www-form-urlencoded",
      "Cache-Control": "no-cache",
    },
    body: new URLSearchParams({
      client_key: process.env.TIKTOK_CLIENT_KEY!,
      client_secret: process.env.TIKTOK_CLIENT_SECRET!,
      grant_type: "refresh_token",
      refresh_token: refreshToken,
    }),
  });
  const data = await res.json();
  if (data.error) {
    throw new ApiError(401, `TikTok token refresh failed: ${data.error}`, "TIKTOK_TOKEN_REFRESH_FAILED");
  }
  const now = Date.now();
  await updateTiktokTokens(userId, {
    tiktokAccessToken: data.access_token,
    tiktokRefreshToken: data.refresh_token,
    tiktokExpiresAt: now + data.expires_in * 1000,
    tiktokRefreshExpiresAt: now + data.refresh_expires_in * 1000,
  });
  return data.access_token as string;
};

export const getValidAccessToken = async (userId: string): Promise<string> => {
  const conn = await getUserTiktokTokens(userId);
  if (!conn) throw new ApiError(404, "TikTok account not connected", "TIKTOK_NOT_CONNECTED");

  const now = Date.now();
  if (now + REFRESH_BUFFER_MS < Number(conn.tiktokExpiresAt)) {
    return conn.tiktokAccessToken;
  }

  // Access token is expired (or about to); try refresh
  if (now >= Number(conn.tiktokRefreshExpiresAt)) {
    throw new ApiError(401, "TikTok session expired — please reconnect your TikTok account", "TIKTOK_REFRESH_EXPIRED");
  }

  return refreshAccessToken(userId, conn.tiktokRefreshToken);
};

export const exchangeCodeForToken = async (code: string, userId: string) => {
  const res = await fetch("https://open.tiktokapis.com/v2/oauth/token/", {
    method: "POST",
    headers: {
      "Content-Type": "application/x-www-form-urlencoded",
      "Cache-Control": "no-cache",
    },
    body: new URLSearchParams({
      client_key: process.env.TIKTOK_CLIENT_KEY!,
      client_secret: process.env.TIKTOK_CLIENT_SECRET!,
      code,
      grant_type: "authorization_code",
      redirect_uri: process.env.TIKTOK_REDIRECT_URI!,
    }),
  });
  const data = await res.json();
  if (data.error)
    throw new ApiError(
      400,
      `TikTok OAuth error: ${data.error}`,
      "TIKTOK_OAUTH_ERROR",
    );

  const profile = await fetchTiktokProfile(data.access_token);
  const now = Date.now();

  await createTiktokConnection({
    userId,
    tiktokUserId: data.open_id,
    tiktokAccessToken: data.access_token,
    tiktokRefreshToken: data.refresh_token,
    tiktokExpiresAt: now + data.expires_in * 1000,
    tiktokRefreshExpiresAt: now + data.refresh_expires_in * 1000,
    displayName: profile.display_name,
    avatarUrl: profile.avatar_url,
    username: profile.username,
  });

  return data;
};

export const getUserTiktokConnectionDetailsService = async (userId: string) => {
  return getUserTiktokConnectionDetails({ userId });
};

export const disconnectTiktokService = async (userId: string) => {
  return deleteTiktokConnection(userId);
};

export const getUserTiktokProfileService = async (userId: string) => {
  const accessToken = await getValidAccessToken(userId);
  return fetchTiktokProfile(accessToken);
};

export const getCreatorInfoService = async (userId: string) => {
  const accessToken = await getValidAccessToken(userId);

  const res = await fetch(
    "https://open.tiktokapis.com/v2/post/publish/creator_info/query/",
    {
      method: "POST",
      headers: {
        Authorization: `Bearer ${accessToken}`,
        "Content-Type": "application/json; charset=UTF-8",
      },
      body: JSON.stringify({}),
    },
  );
  const data = await res.json();
  if (data.error?.code !== "ok") {
    throw new ApiError(
      400,
      `TikTok creator info error: ${data.error?.message}`,
      "TIKTOK_API_ERROR",
    );
  }

  const c = data.data;
  return {
    creatorAvatarUrl: c.creator_avatar_url as string,
    creatorUsername: c.creator_username as string,
    creatorNickname: c.creator_nickname as string,
    privacyLevelOptions: c.privacy_level_options as string[],
    commentDisabled: c.comment_disabled as boolean,
    duetDisabled: c.duet_disabled as boolean,
    stitchDisabled: c.stitch_disabled as boolean,
    maxVideoPostDurationSec: c.max_video_post_duration_sec as number,
  };
};

export const uploadToTiktokService = async (
  userId: string,
  pipelineId: string,
  title: string,
  privacyLevel: string,
  disableComment: boolean,
  disableDuet: boolean,
  disableStitch: boolean,
  brandContentToggle: boolean,
  brandOrganicToggle: boolean,
  isAigc: boolean,
) => {
  // getValidAccessToken is called inside getCreatorInfoService; resolve token once
  // here so the publish call can reuse it without a second DB round-trip.
  const accessToken = await getValidAccessToken(userId);

  // Validate privacy level and duration against this creator's TikTok limits.
  const [creatorInfo, pipeline] = await Promise.all([
    getCreatorInfoService(userId),
    findPipelineById(pipelineId, userId),
  ]);

  if (!pipeline) {
    throw new ApiError(404, "Pipeline not found", "PIPELINE_NOT_FOUND");
  }

  if (pipeline.pipelineStatus !== "video_generated") {
    throw new ApiError(400, "Pipeline video is not ready for publishing", "PIPELINE_NOT_READY");
  }

  if (!pipeline.s3key) {
    throw new ApiError(400, "Pipeline has no video", "PIPELINE_NO_VIDEO");
  }

  const videoUrl = `https://${process.env.AWS_CLOUDFRONT_DOMAIN}/${pipeline.s3key}`;

  if (!creatorInfo.privacyLevelOptions.includes(privacyLevel)) {
    throw new ApiError(
      400,
      "Invalid privacy level for this creator",
      "INVALID_PRIVACY_LEVEL",
    );
  }

  if (pipeline.videoDurationSec == null) {
    throw new ApiError(
      400,
      "Video duration is unknown — regenerate the video before publishing",
      "VIDEO_DURATION_UNKNOWN",
    );
  }

  if (pipeline.videoDurationSec > creatorInfo.maxVideoPostDurationSec) {
    throw new ApiError(
      400,
      `Video is ${pipeline.videoDurationSec.toFixed(1)}s but your TikTok account allows a maximum of ${creatorInfo.maxVideoPostDurationSec}s`,
      "VIDEO_TOO_LONG_FOR_TIKTOK",
    );
  }

  const postInfo: Record<string, unknown> = {
    title,
    privacy_level: privacyLevel,
    disable_comment: disableComment,
    disable_duet: disableDuet,
    disable_stitch: disableStitch,
    brand_content_toggle: brandContentToggle,
    brand_organic_toggle: brandOrganicToggle,
    video_cover_timestamp_ms: 0,
    is_aigc: isAigc,
  };

  const res = await fetch(
    "https://open.tiktokapis.com/v2/post/publish/video/init/",
    {
      method: "POST",
      headers: {
        Authorization: `Bearer ${accessToken}`,
        "Content-Type": "application/json; charset=UTF-8",
      },
      body: JSON.stringify({
        post_info: postInfo,
        source_info: {
          source: "PULL_FROM_URL",
          video_url: videoUrl,
        },
      }),
    },
  );
  const data = await res.json();
  if (data.error?.code !== "ok") {
    throw new ApiError(
      400,
      `TikTok init failed: ${data.error.code} — ${data.error.message}`,
      "TIKTOK_API_ERROR",
    );
  }
  const publishId = data.data.publish_id;
  await publishToTiktok(pipelineId, userId, publishId);
  await enqueueTiktokStatusPoll(publishId, pipelineId, userId);
  return publishId;
};
