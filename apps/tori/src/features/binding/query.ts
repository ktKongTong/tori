import { useQuery } from "@tanstack/react-query";
import type { PageBasedPaginationParam } from "@repo/utils/schema/paging";

import {
  listChannelBindings,
  listClaimSessions,
  listUserBindings,
  type ChannelBindingListItem,
  type UserBindingListItem,
} from "./api";

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
    queryFn: async () => {
      const bindings = await listUserBindings(pagination);
      return {
        items: bindings.data.map(
          (binding): UserBindingListItem => ({
            binding,
            user: null,
          }),
        ),
      };
    },
    staleTime: 0,
    refetchOnWindowFocus: true,
  });
}

export function useChannelBindingsQuery(
  pagination: PageBasedPaginationParam = { page: 1, pageSize: 100 },
) {
  return useQuery({
    queryKey: bindingQueryKeys.channelBindings(pagination),
    queryFn: async () => {
      const bindings = await listChannelBindings(pagination);
      return {
        items: bindings.data.map(
          (binding): ChannelBindingListItem => ({
            binding,
            channel: null,
            botInstance: null,
          }),
        ),
      };
    },
    staleTime: 0,
    refetchOnWindowFocus: true,
  });
}

export function useClaimSessionsQuery(
  pagination: PageBasedPaginationParam = { page: 1, pageSize: 100 },
) {
  return useQuery({
    queryKey: bindingQueryKeys.claimSessions(pagination),
    queryFn: async () => {
      const page = await listClaimSessions(pagination);
      return { items: page.data, page: page.page };
    },
    staleTime: 0,
    refetchOnWindowFocus: true,
  });
}
