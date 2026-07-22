import { useQuery } from "@tanstack/react-query";
import { getLatestAnalyticsService, getAnalyticsHistoryService } from "@/services/analytics.service";

export const useGetLatestAnalytics = () =>
  useQuery({
    queryKey: ["analytics", "latest"],
    queryFn: getLatestAnalyticsService,
    retry: false,
  });

export const useGetAnalyticsHistory = () =>
  useQuery({
    queryKey: ["analytics", "history"],
    queryFn: getAnalyticsHistoryService,
  });
