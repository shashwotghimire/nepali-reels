import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import {
  generateScriptService,
  getReelsService,
  getPipelineByIdService,
} from "@/services/pipeline.service";
import type {
  GenerateScriptRequest,
  GetReelsParams,
} from "@/types/api/pipeline-api.types";

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

export const useGenerateScript = () => {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (body: GenerateScriptRequest) => generateScriptService(body),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["pipeline", "reels"] });
    },
  });
};
