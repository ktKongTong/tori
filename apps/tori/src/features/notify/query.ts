import { useQuery } from "@tanstack/react-query";
import type { PageBasedPaginationParam } from "@repo/utils/schema/paging";

import { getSubscriptionDetail, listNotifyEvents, listNotifySubscriptions } from "./api";

export const notifyQueryKeys = {
  subscriptions: (pagination: PageBasedPaginationParam) =>
    ["notify", "subscriptions", pagination] as const,
  subscriptionDetail: (id: string) => ["notify", "subscriptions", id] as const,
  events: (subscriptionId: string, pagination: PageBasedPaginationParam) =>
    ["notify", "events", subscriptionId, pagination] as const,
};

export function useNotificationSubscriptionsQuery(
  pagination: PageBasedPaginationParam = { page: 1, pageSize: 100 },
) {
  return useQuery({
    queryKey: notifyQueryKeys.subscriptions(pagination),
    queryFn: () => listNotifySubscriptions(pagination),
    staleTime: 0,
    refetchOnWindowFocus: true,
  });
}

export function useNotifySubscriptionDetailQuery(id: string) {
  return useQuery({
    queryKey: notifyQueryKeys.subscriptionDetail(id),
    queryFn: () => getSubscriptionDetail(id),
    staleTime: 0,
    refetchOnWindowFocus: true,
    enabled: !!id,
  });
}

export function useNotifyEventsQuery(
  subscriptionId: string,
  pagination: PageBasedPaginationParam = { page: 1, pageSize: 10 },
) {
  return useQuery({
    queryKey: notifyQueryKeys.events(subscriptionId, pagination),
    queryFn: () => listNotifyEvents(subscriptionId, pagination),
    staleTime: 0,
    refetchOnWindowFocus: true,
  });
}
