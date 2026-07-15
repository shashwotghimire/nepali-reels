import axiosInstance from "@/lib/axios";
import type {
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
  const res = (
    await axiosInstance.get<{ data: Reel }>(`/api/pipeline/${id}`)
  ).data;
  return res.data;
};
