import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import {
  connectTiktokService,
  disconnectTiktokService,
  getUserTiktokConnectionDetails,
  getCreatorInfoService,
  publishToTiktokService,
} from "@/services/tiktok.service";
import type {
  UserTiktokConnectionDetailsResponse,
  PublishToTiktokRequest,
} from "@/types/api/tiktok-api.types";

const isRefreshExpired = (error: unknown) =>
  (error as any)?.response?.data?.errorCode === "TIKTOK_REFRESH_EXPIRED";

const toastReconnect = () =>
  toast.error("TikTok session expired — please reconnect your account", {
    action: { label: "Reconnect", onClick: connectTiktokService },
  });

export const useGetTiktokConnectionDetails = () =>
  useQuery<UserTiktokConnectionDetailsResponse>({
    queryKey: ["tiktok", "status"],
    queryFn: getUserTiktokConnectionDetails,
  });

export const useGetCreatorInfo = (enabled: boolean) =>
  useQuery({
    queryKey: ["tiktok", "creator-info"],
    queryFn: getCreatorInfoService,
    enabled,
    staleTime: 0,
    gcTime: 0,
    throwOnError: (error) => {
      if (isRefreshExpired(error)) {
        toastReconnect();
        return false;
      }
      return true;
    },
  });

export const useDisconnectTiktok = () => {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: disconnectTiktokService,
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["tiktok", "status"] }),
  });
};

export const usePublishToTiktok = (pipelineId: string) => {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (body: PublishToTiktokRequest) => publishToTiktokService(body),
    onSuccess: () => {
      toast.success("Published to TikTok");
      queryClient.invalidateQueries({ queryKey: ["pipeline", pipelineId] });
    },
    onError: (error: unknown) => {
      if (isRefreshExpired(error)) {
        toastReconnect();
        return;
      }
      const message = (error as any)?.response?.data?.message ?? "Failed to publish to TikTok";
      toast.error(message);
    },
  });
};
