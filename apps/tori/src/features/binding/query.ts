import { useQuery } from "@tanstack/react-query";
import type { PageBasedPaginationParam } from "@repo/utils/schema/paging";

import { listChannelBindings, listClaimSessions, listUserBindings } from "./api";

export const bindingQueryKeys = {
  userBindings: (pagination: PageBasedPaginationParam) =>
    ["binding", "user-bindings", pagination] as const,
  channelBindings: (pagination: PageBasedPaginationParam) =>
    ["binding", "channel-bindings", pagination] as const,
  claimSessions: (pagination: PageBasedPaginationParam) =>
    ["binding", "claim-sessions", pagination] as const,
};

export function useUserBindingsQuery(
  pagination: PageBasedPaginationParam = { page: 1, pageSize: 100 },
) {
  return useQuery({
    queryKey: bindingQueryKeys.userBindings(pagination),
    queryFn: async () => listUserBindings(pagination),
    staleTime: 0,
    refetchOnWindowFocus: true,
  });
}

export function useChannelBindingsQuery(
  pagination: PageBasedPaginationParam = { page: 1, pageSize: 100 },
) {
  return useQuery({
    queryKey: bindingQueryKeys.channelBindings(pagination),
    queryFn: async () => listChannelBindings(pagination),
    staleTime: 0,
    refetchOnWindowFocus: true,
  });
}

export function useClaimSessionsQuery(
  pagination: PageBasedPaginationParam = { page: 1, pageSize: 100 },
) {
  return useQuery({
    queryKey: bindingQueryKeys.claimSessions(pagination),
    queryFn: async () => listClaimSessions(pagination),
    staleTime: 0,
    refetchOnWindowFocus: true,
  });
}
