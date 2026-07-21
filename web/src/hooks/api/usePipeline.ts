import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import {
  generateScriptService,
  getReelsService,
  getPipelineByIdService,
  deletePipelineService,
} from "@/services/pipeline.service";
import type {
  GenerateScriptRequest,
  GetReelsParams,
} from "@/types/api/pipeline-api.types";

export const useGetReelsOfUser = (params?: GetReelsParams) =>
  useQuery({
    queryKey: ["pipeline", "reels", params],
    queryFn: () => getReelsService(params),
    placeholderData: (prev) => prev,
  });

export const useGetPipelineById = (id: string) =>
  useQuery({
    queryKey: ["pipeline", id],
    queryFn: () => getPipelineByIdService(id),
    enabled: !!id,
    refetchInterval: (query) =>
      query.state.data?.pipelineStatus === "publish_pending" ? 5000 : false,
  });

export const useDeletePipeline = () => {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (id: string) => deletePipelineService(id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["pipeline", "reels"] });
    },
  });
};

export const useGenerateScript = () => {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (body: GenerateScriptRequest) => generateScriptService(body),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["pipeline", "reels"] });
    },
  });
};
