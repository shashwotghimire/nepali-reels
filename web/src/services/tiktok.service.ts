import axiosInstance from "@/lib/axios";
import type {
  UserTiktokConnectionDetailsResponse,
  PublishToTiktokRequest,
  PublishToTiktokResponse,
} from "@/types/api/tiktok-api.types";

export const connectTiktokService = async () => {
  window.location.href = `${import.meta.env.VITE_API_BASE_URL}/api/tiktok/connect`;
};

export const disconnectTiktokService = async () => {
  await axiosInstance.delete("/api/tiktok/disconnect");
};

export const getUserTiktokConnectionDetails = async () => {
  const res = (
    await axiosInstance.get<{ data: UserTiktokConnectionDetailsResponse }>(
      "/api/tiktok/status",
    )
  ).data;
  return res.data;
};

export const publishToTiktokService = async (body: PublishToTiktokRequest) => {
  const res = (
    await axiosInstance.post<{ data: PublishToTiktokResponse }>(
      "/api/tiktok/publish",
      body,
    )
  ).data;
  return res.data;
};
