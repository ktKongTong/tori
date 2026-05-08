import { useQuery } from "@tanstack/react-query";

import {
  getSubscriptionDetail,
  listDeliveryEndpoints,
  listNotifyEvents,
  listNotifySubscriptions,
} from "./api";

export const notifyQueryKeys = {
  subscriptions: () => ["notify", "subscriptions"] as const,
  subscriptionDetail: (id: string, pagination: { page: number; pageSize: number }) =>
    ["notify", "subscriptions", id, pagination] as const,
  events: () => ["notify", "events"] as const,
  deliveryEndpoints: () => ["notify", "delivery-endpoints"] as const,
};

export function useNotificationSubscriptionsQuery() {
  return useQuery({
    queryKey: notifyQueryKeys.subscriptions(),
    queryFn: listNotifySubscriptions,
    staleTime: 0,
    refetchOnWindowFocus: true,
  });
}

export function useNotifySubscriptionDetailQuery(
  id: string,
  pagination: { page: number; pageSize: number },
) {
  return useQuery({
    queryKey: notifyQueryKeys.subscriptionDetail(id, pagination),
    queryFn: () => getSubscriptionDetail(id),
    staleTime: 0,
    refetchOnWindowFocus: true,
    enabled: !!id,
  });
}

export function useNotifyEventsQuery(subscriptionId: string) {
  return useQuery({
    queryKey: notifyQueryKeys.events(),
    queryFn: () => listNotifyEvents(subscriptionId),
    staleTime: 0,
    refetchOnWindowFocus: true,
  });
}
