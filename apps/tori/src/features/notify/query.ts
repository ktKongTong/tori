import { useQuery } from "@tanstack/react-query";

import { getNotifyEndpoints, getNotifyEvents, getNotifySubscriptions } from "./api";

export const notifyQueryKeys = {
  endpoints: () => ["dashboard", "notify", "delivery-endpoints"] as const,
  subscriptions: () => ["dashboard", "notify", "subscriptions"] as const,
  events: () => ["dashboard", "notify", "events"] as const,
};

export function useDashboardNotifyEndpointsQuery() {
  return useQuery({
    queryKey: notifyQueryKeys.endpoints(),
    queryFn: getNotifyEndpoints,
    staleTime: 0,
    refetchOnWindowFocus: true,
  });
}

export function useDashboardNotifySubscriptionsQuery() {
  return useQuery({
    queryKey: notifyQueryKeys.subscriptions(),
    queryFn: getNotifySubscriptions,
    staleTime: 0,
    refetchOnWindowFocus: true,
  });
}

export function useDashboardNotifyEventsQuery() {
  return useQuery({
    queryKey: notifyQueryKeys.events(),
    queryFn: getNotifyEvents,
    staleTime: 0,
    refetchOnWindowFocus: true,
  });
}
