import axiosInstance from "@/lib/axios";
import type {
  GenerateScriptRequest,
  GenerateScriptResponse,
  GetReelsParams,
  GetReelsResponse,
  Reel,
} from "@/types/api/pipeline-api.types";

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
      body
    )
  ).data;
  return res.data;
};
