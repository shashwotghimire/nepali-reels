import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import {
  generateScriptService,
  getReelsService,
  getPipelineByIdService,
  deletePipelineService,
  retryPipelineService,
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

const TERMINAL_STATUSES = ["video_generated", "published", "failed"];

export const useGetPipelineById = (id: string) =>
  useQuery({
    queryKey: ["pipeline", id],
    queryFn: () => getPipelineByIdService(id),
    enabled: !!id,
    refetchInterval: (query) => {
      const status = query.state.data?.pipelineStatus;
      if (!status) return false;
      if (!TERMINAL_STATUSES.includes(status)) return 5000;
      return false;
    },
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

export const useRetryPipeline = (id: string) => {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: () => retryPipelineService(id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["pipeline", id] });
    },
  });
};
