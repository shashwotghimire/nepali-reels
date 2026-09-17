import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import {
  generateScriptService,
  getReelsService,
  getPipelineByIdService,
  deletePipelineService,
  retryPipelineService,
  approveScriptService,
  editScriptService,
  getEntitlementsService,
  reviseScriptService,
  regenerateThumbnailService,
  selectThumbnailService,
  createChannelStyleService,
  deleteChannelStyleService,
  getChannelStylesService,
  abandonUncertainOperationService,
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

const TERMINAL_STATUSES = ["video_generated", "published", "failed", "awaiting_script_approval"];

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

export const useGenerationEntitlements = () => useQuery({
  queryKey: ["pipeline", "entitlements"], queryFn: getEntitlementsService,
});

function useScriptMutation<T>(id: string, mutationFn: (input: T) => Promise<unknown>) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn,
    onSettled: () => queryClient.invalidateQueries({ queryKey: ["pipeline", id] }),
  });
}

export const useEditScript = (id: string) => useScriptMutation(id, (input: { expectedVersion: number; script: object }) =>
  editScriptService(id, input.expectedVersion, input.script));
export const useReviseScript = (id: string) => useScriptMutation(id, (input: { expectedVersion: number; instruction: string; idempotencyKey?: string }) =>
  reviseScriptService(id, input.expectedVersion, input.instruction, input.idempotencyKey));
export const useApproveScript = (id: string) => useScriptMutation(id, (expectedVersion: number) =>
  approveScriptService(id, expectedVersion));
export const useRegenerateThumbnail = (id: string) => useScriptMutation(id, (idempotencyKey?: string) => regenerateThumbnailService(id, idempotencyKey));
export const useSelectThumbnail = (id: string) => useScriptMutation(id, (version: number) => selectThumbnailService(id, version));
export const useChannelStyles = () => useQuery({ queryKey: ["pipeline", "styles"], queryFn: getChannelStylesService });
export const useCreateChannelStyle = () => { const qc = useQueryClient(); return useMutation({ mutationFn: createChannelStyleService, onSuccess: () => qc.invalidateQueries({ queryKey: ["pipeline", "styles"] }) }); };
export const useDeleteChannelStyle = () => { const qc = useQueryClient(); return useMutation({ mutationFn: deleteChannelStyleService, onSuccess: () => qc.invalidateQueries({ queryKey: ["pipeline", "styles"] }) }); };
export const useAbandonUncertainOperation = (id: string) => useScriptMutation(id, (input: { kind: string; key: string }) => abandonUncertainOperationService(id, input.kind, input.key));

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
