import { useQuery } from "@tanstack/react-query";
import { getReelsService, getPipelineByIdService } from "@/services/pipeline.service";
import type { GetReelsParams } from "@/types/api/pipeline-api.types";

export const useGetReelsOfUser = (params?: GetReelsParams) =>
  useQuery({
    queryKey: ["pipeline", "reels", params],
    queryFn: () => getReelsService(params),
  });

export const useGetPipelineById = (id: string) =>
  useQuery({
    queryKey: ["pipeline", id],
    queryFn: () => getPipelineByIdService(id),
    enabled: !!id,
  });
