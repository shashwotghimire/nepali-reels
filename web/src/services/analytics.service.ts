import axiosInstance from "@/lib/axios";
import type { AnalyticsRecord } from "@/types/api/analytics-api.types";

export const getLatestAnalyticsService = async () => {
  const res = (await axiosInstance.get<{ data: AnalyticsRecord }>("/api/analytics/latest")).data;
  return res.data;
};

export const getAnalyticsHistoryService = async () => {
  const res = (await axiosInstance.get<{ data: AnalyticsRecord[] }>("/api/analytics/history")).data;
  return res.data;
};
