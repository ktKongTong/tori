import { useQuery } from "@tanstack/react-query";

import { getBotInstances } from "./api";

export const botInstancesQueryKeys = {
  botInstances: () => ["dashboard", "bot-instances"] as const,
};

export function useDashboardBotInstancesQuery() {
  return useQuery({
    queryKey: botInstancesQueryKeys.botInstances(),
    queryFn: getBotInstances,
    staleTime: 0,
    refetchOnWindowFocus: true,
  });
}
