import axiosInstance from "@/lib/axios";
import type {
  GenerateScriptRequest,
  GenerateScriptResponse,
  GetReelsParams,
  GetReelsResponse,
  Reel,
  GenerationEntitlements,
  ChannelStyle,
} from "@/types/api/pipeline-api.types";
import { acknowledgeKeyedOperation, runKeyedOperation, type OperationKind } from "@/services/operation-key";

export const getReelsService = async (params?: GetReelsParams) => {
  const res = (
    await axiosInstance.get<{ data: GetReelsResponse }>("/api/pipeline", {
      params,
    })
  ).data;
  return res.data;
};

export const getPipelineByIdService = async (id: string) => {
  const res = (await axiosInstance.get<{ data: Reel }>(`/api/pipeline/${id}`))
    .data;
  return res.data;
};

export const getPipelineAudioUrl = (id: string) =>
  `${import.meta.env.VITE_API_BASE_URL}/api/pipeline/${id}/audio`;

export const generateScriptService = async (body: GenerateScriptRequest) => {
  const res = (
    await axiosInstance.post<{ data: GenerateScriptResponse }>(
      "/api/pipeline/generate-script",
      body,
    )
  ).data;
  return res.data;
};

export const getPipelineVideoUrl = (id: string) =>
  `${import.meta.env.VITE_API_BASE_URL}/api/pipeline/${id}/video`;

export const deletePipelineService = async (id: string) => {
  await axiosInstance.delete(`/api/pipeline/${id}`);
};

export const retryPipelineService = async (id: string) => {
  const res = (
    await axiosInstance.post<{ data: { pipelineId: string; resumeFrom: string } }>(
      `/api/pipeline/${id}/retry`,
    )
  ).data;
  return res.data;
};

export const getEntitlementsService = async () => {
  const res = (await axiosInstance.get<{ data: GenerationEntitlements }>("/api/pipeline/entitlements")).data;
  return res.data;
};

export const editScriptService = async (id: string, expectedVersion: number, script: object) => {
  const res = (await axiosInstance.patch<{ data: Reel }>(`/api/pipeline/${id}/script`, { expectedVersion, script })).data;
  return res.data;
};

export const reviseScriptService = async (id: string, expectedVersion: number, instruction: string, suppliedKey?: string) => {
  return runKeyedOperation({ kind: "script-revision", id, payload: JSON.stringify([expectedVersion, instruction]), suppliedKey, execute: async (key) => {
    const res = (await axiosInstance.post<{ data: Reel }>(`/api/pipeline/${id}/script/revise`, { expectedVersion, instruction }, { headers: { "Idempotency-Key": key } })).data;
    return res.data;
  } });
};

export const approveScriptService = async (id: string, expectedVersion: number) => {
  const res = (await axiosInstance.post<{ data: Reel }>(`/api/pipeline/${id}/script/approve`, { expectedVersion })).data;
  return res.data;
};

export const regenerateThumbnailService = async (id: string, suppliedKey?: string) => {
  return runKeyedOperation({ kind: "thumbnail-regeneration", id, payload: "regenerate", suppliedKey, execute: async (key) => {
    const res = (await axiosInstance.post<{ data: Reel }>(`/api/pipeline/${id}/thumbnails/regenerate`, undefined, { headers: { "Idempotency-Key": key } })).data;
    return res.data;
  } });
};
export const selectThumbnailService = async (id: string, version: number) => {
  const res = (await axiosInstance.post<{ data: Reel }>(`/api/pipeline/${id}/thumbnails/${version}/select`)).data;
  return res.data;
};
export const getChannelStylesService = async () => ((await axiosInstance.get<{ data: ChannelStyle[] }>("/api/pipeline/styles")).data.data);
export const createChannelStyleService = async (form: FormData) => ((await axiosInstance.post<{ data: ChannelStyle }>("/api/pipeline/styles", form)).data.data);
export const deleteChannelStyleService = async (id: string) => { await axiosInstance.delete(`/api/pipeline/styles/${id}`); };
export const abandonUncertainOperationService = async (id: string, kind: "script_revision" | "thumbnail_regeneration", key: string) => acknowledgeKeyedOperation({
  kind: (kind === "script_revision" ? "script-revision" : "thumbnail-regeneration") satisfies OperationKind,
  id,
  key,
  execute: async () => { await axiosInstance.post(`/api/pipeline/${id}/operations/${kind}/${encodeURIComponent(key)}/abandon`); },
});
