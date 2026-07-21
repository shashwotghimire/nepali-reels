import {
  findAllReelsOfUser,
  findPipelineById,
  deletePipelineById,
} from "../repositories/reels.repository";
import { ApiError } from "../utils/ApiError.util";

export const getPipelineByIdService = async (
  userId: string,
  pipelineId: string,
) => {
  const pipeline = await findPipelineById(pipelineId, userId);
  if (!pipeline) {
    throw new ApiError(404, "Pipeline not found", "Pipeline not found");
  }
  return pipeline;
};

export const deletePipelineService = async (userId: string, pipelineId: string) => {
  const pipeline = await findPipelineById(pipelineId, userId);
  if (!pipeline) {
    throw new ApiError(404, "Pipeline not found", "Pipeline not found");
  }
  await deletePipelineById(pipelineId, userId);
};

const buildVideoUrl = (s3key: string | null): string | null => {
  if (!s3key) return null;
  const domain = process.env.AWS_CLOUDFRONT_DOMAIN;
  if (domain) return `https://${domain}/${s3key}`;
  return null;
};

export const getReelsService = async (
  userId: string,
  page: number,
  limit: number,
  search?: string,
) => {
  const offset = (page - 1) * limit;
  const { rows, count } = await findAllReelsOfUser(
    userId,
    limit,
    offset,
    search,
  );
  const reels = rows.map((r) => ({
    ...r.toJSON(),
    videoUrl: buildVideoUrl(r.s3key),
  }));
  return {
    reels,
    totalItems: count,
    totalPages: Math.ceil(count / limit),
    currentPage: page,
  };
};
