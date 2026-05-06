import { useQuery } from "@tanstack/react-query";

import { getIntegration } from "./api";

export const integrationQueryKeys = {
  integration: () => ["dashboard", "integration"] as const,
};

export function useDashboardIntegrationQuery() {
  return useQuery({
    queryKey: integrationQueryKeys.integration(),
    queryFn: getIntegration,
    staleTime: 0,
    refetchOnWindowFocus: true,
  });
}
