import { ApiError } from "../utils/ApiError.util";
import {
  findLatestAnalyticsByUser,
  findAllAnalyticsByUser,
} from "../repositories/analytics.repository";

export const getLatestAnalyticsService = async (userId: string) => {
  const record = await findLatestAnalyticsByUser(userId);
  if (!record) throw new ApiError(404, "No analytics report found", "ANALYTICS_NOT_FOUND");
  return record;
};

export const getAllAnalyticsService = (userId: string) => {
  return findAllAnalyticsByUser(userId);
};
