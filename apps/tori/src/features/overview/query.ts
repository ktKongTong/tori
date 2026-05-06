import { useQuery } from "@tanstack/react-query";

import { getOverview } from "./api";

export const dashboardQueryKeys = {
  overview: () => ["dashboard", "demo", "overview"] as const,
};

export function useDashboardOverviewQuery() {
  return useQuery({
    queryKey: dashboardQueryKeys.overview(),
    queryFn: getOverview,
  });
}
