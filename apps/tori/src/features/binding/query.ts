import { useQuery } from "@tanstack/react-query";

import {
  listChannelBindings,
  listClaimSessions,
  listUserBindings,
  type ChannelBindingRow,
  type UserBindingRow,
} from "./api";

export const bindingQueryKeys = {
  userBindings: () => ["binding", "user-bindings"] as const,
  channelBindings: () => ["binding", "channel-bindings"] as const,
  claimSessions: () => ["binding", "claim-sessions"] as const,
};

export function useUserBindingsQuery() {
  return useQuery({
    queryKey: bindingQueryKeys.userBindings(),
    queryFn: async () => {
      const bindings = await listUserBindings();
      return {
        items: bindings.items.map(
          (binding): UserBindingRow => ({
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

export function useChannelBindingsQuery() {
  return useQuery({
    queryKey: bindingQueryKeys.channelBindings(),
    queryFn: async () => {
      const bindings = await listChannelBindings();
      return {
        items: bindings.items.map(
          (binding): ChannelBindingRow => ({
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

export function useClaimSessionsQuery() {
  return useQuery({
    queryKey: bindingQueryKeys.claimSessions(),
    queryFn: listClaimSessions,
    staleTime: 0,
    refetchOnWindowFocus: true,
  });
}
