import { useQuery } from "@tanstack/react-query";
import type { PageBasedPaginationParam } from "@repo/utils/schema/paging";

import { listAccountProfiles, listConnections, listProxyInstances } from "./api";

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
    queryFn: async () => {
      const page = await listProxyInstances(pagination);
      return { items: page.data, page: page.page };
    },
    staleTime: 0,
    refetchOnWindowFocus: true,
  });
}

export function useConnectionsQuery(
  pagination: PageBasedPaginationParam = { page: 1, pageSize: 100 },
) {
  return useQuery({
    queryKey: integrationQueryKeys.connections(pagination),
    queryFn: async () => {
      const [connections, proxies, profiles] = await Promise.all([
        listConnections(pagination),
        listProxyInstances(),
        listAccountProfiles(),
      ]);
      const proxyById = new Map(proxies.data.map((proxy) => [proxy.id, proxy]));
      const profileByConnectionId = new Map(
        profiles.data.map((profile) => [profile.connectionId, profile]),
      );

      return {
        items: connections.data.map((connection) => ({
          connection,
          proxy: connection.proxyInstanceId
            ? (proxyById.get(connection.proxyInstanceId) ?? null)
            : null,
          profile: profileByConnectionId.get(connection.id) ?? null,
        })),
      };
    },
    staleTime: 0,
    refetchOnWindowFocus: true,
  });
}
