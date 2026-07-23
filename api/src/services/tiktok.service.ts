import { generateToken } from "../helpers/crypto.helper";
import {
  createTiktokConnection,
  deleteTiktokConnection,
  getUserTiktokConnectionDetails,
  getUserTiktokAccessToken,
} from "../repositories/tiktok.repository";
import { publishToTiktok } from "../repositories/reels.repository";
import { ApiError } from "../utils/ApiError.util";
import { enqueueTiktokStatusPoll } from "../queue/tiktok.queue";

export const buildAuthUrl = () => {
  const state = generateToken();
  const url = new URL("https://www.tiktok.com/v2/auth/authorize/");
  url.searchParams.set("client_key", process.env.TIKTOK_CLIENT_KEY!);
  url.searchParams.set(
    "scope",
    "user.info.basic,user.info.profile,user.info.stats,video.publish",
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
  const connection = await getUserTiktokAccessToken(userId);
  if (!connection)
    throw new ApiError(
      404,
      "TikTok account not connected",
      "TIKTOK_NOT_CONNECTED",
    );
  return fetchTiktokProfile(connection.tiktokAccessToken);
};

export const uploadToTiktokService = async (
  userId: string,
  pipelineId: string,
  videoUrl: string,
  title: string,
) => {
  const connection = await getUserTiktokAccessToken(userId);
  if (!connection)
    throw new ApiError(
      404,
      "TikTok account not connected",
      "TIKTOK_NOT_CONNECTED",
    );

  const postInfo: Record<string, unknown> = {
    title,
    privacy_level: "SELF_ONLY",
    disable_duet: false,
    disable_comment: false,
    disable_stitch: false,
    video_cover_timestamp_ms: 0,
  };

  const res = await fetch(
    "https://open.tiktokapis.com/v2/post/publish/video/init/",
    {
      method: "POST",
      headers: {
        Authorization: `Bearer ${connection.tiktokAccessToken}`,
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
    throw new Error(
      `TikTok init failed: ${data.error.code} — ${data.error.message}`,
    );
  }
  const publishId = data.data.publish_id;
  await publishToTiktok(pipelineId, userId, publishId);
  await enqueueTiktokStatusPoll(publishId, pipelineId, userId);
  return publishId;
};
