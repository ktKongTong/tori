import { useQuery } from "@tanstack/react-query";

import { listAccountProfiles, listConnections, listProxyInstances } from "./api";

export const integrationQueryKeys = {
  proxyInstances: () => ["integration", "proxy-instances"] as const,
  connections: () => ["integration", "connections"] as const,
  accountProfiles: () => ["integration", "account-profiles"] as const,
};

export function useProxyInstancesQuery() {
  return useQuery({
    queryKey: integrationQueryKeys.proxyInstances(),
    queryFn: listProxyInstances,
    staleTime: 0,
    refetchOnWindowFocus: true,
  });
}

export function useConnectionsQuery() {
  return useQuery({
    queryKey: integrationQueryKeys.connections(),
    queryFn: async () => {
      const [connections, proxies, profiles] = await Promise.all([
        listConnections(),
        listProxyInstances(),
        listAccountProfiles(),
      ]);
      const proxyById = new Map(proxies.items.map((proxy) => [proxy.id, proxy]));
      const profileByConnectionId = new Map(
        profiles.items.map((profile) => [profile.connectionId, profile]),
      );

      return {
        items: connections.items.map((connection) => ({
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
