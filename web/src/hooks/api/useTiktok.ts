import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import {
  disconnectTiktokService,
  getUserTiktokConnectionDetails,
  publishToTiktokService,
} from "@/services/tiktok.service";
import type {
  UserTiktokConnectionDetailsResponse,
  PublishToTiktokRequest,
} from "@/types/api/tiktok-api.types";

export const useGetTiktokConnectionDetails = () =>
  useQuery<UserTiktokConnectionDetailsResponse>({
    queryKey: ["tiktok", "status"],
    queryFn: getUserTiktokConnectionDetails,
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
    onError: (error: any) => {
      const message = error?.response?.data?.message ?? "Failed to publish to TikTok";
      toast.error(message);
    },
  });
};
