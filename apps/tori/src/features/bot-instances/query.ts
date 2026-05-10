import { useQuery } from "@tanstack/react-query";
import type { PageBasedPaginationParam } from "@repo/utils/schema/paging";

import { listBotInstances } from "./api";

export const botInstancesQueryKeys = {
  instances: (pagination: PageBasedPaginationParam) =>
    ["bot-plugin", "instances", pagination] as const,
};

export function useBotInstancesQuery(
  pagination: PageBasedPaginationParam = { page: 1, pageSize: 100 },
) {
  return useQuery({
    queryKey: botInstancesQueryKeys.instances(pagination),
    queryFn: async () => {
      return listBotInstances(pagination);
    },
    staleTime: 0,
    refetchOnWindowFocus: true,
  });
}
