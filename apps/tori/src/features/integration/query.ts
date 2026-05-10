import { useQuery } from "@tanstack/react-query";
import type { PageBasedPaginationParam } from "@repo/utils/schema/paging";

import { listConnections, listProxyInstances } from "./api";
import { useToastError } from "@/lib/toast-error.ts";

export const integrationQueryKeys = {
  proxyInstances: (pagination: PageBasedPaginationParam) =>
    ["integration", "proxy-instances", pagination] as const,
  connections: (pagination: PageBasedPaginationParam) =>
    ["integration", "connections", pagination] as const,
  accountProfiles: (pagination: PageBasedPaginationParam) =>
    ["integration", "account-profiles", pagination] as const,
};

export function useProxyInstancesQuery(
  pagination: PageBasedPaginationParam = { page: 1, pageSize: 100 },
) {
  return useQuery({
    queryKey: integrationQueryKeys.proxyInstances(pagination),
    queryFn: async () => listProxyInstances(pagination),
    staleTime: 0,
    refetchOnWindowFocus: true,
  });
}

export function useConnectionsQuery(
  pagination: PageBasedPaginationParam = { page: 1, pageSize: 100 },
) {
  const query = useQuery({
    queryKey: integrationQueryKeys.connections(pagination),
    queryFn: async () => listConnections(pagination),
    staleTime: 0,
    refetchOnWindowFocus: true,
  });

  useToastError(query.error, { title: "Failed to load integrations" });

  return query;
}
