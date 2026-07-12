import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { disconnectTiktokService, getUserTiktokConnectionDetails } from "@/services/tiktok.service";
import type { UserTiktokConnectionDetailsResponse } from "@/types/api/tiktok-api.types";

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
