import {
  findAllReelsOfUser,
  findPipelineById,
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
  return {
    reels: rows,
    totalItems: count,
    totalPages: Math.ceil(count / limit),
    currentPage: page,
  };
};
