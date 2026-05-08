import { useQuery } from "@tanstack/react-query";

import { listBotInstances } from "./api";

export const botInstancesQueryKeys = {
  instances: () => ["bot-plugin", "instances"] as const,
};

export function useBotInstancesQuery() {
  return useQuery({
    queryKey: botInstancesQueryKeys.instances(),
    queryFn: listBotInstances,
    staleTime: 0,
    refetchOnWindowFocus: true,
  });
}
