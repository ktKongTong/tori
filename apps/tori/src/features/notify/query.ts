import { useQuery } from "@tanstack/react-query";

import { getNotifyEvents, getNotifySubscriptions } from "./api";

export const notifyQueryKeys = {
  subscriptions: () => ["dashboard", "notify", "subscriptions"] as const,
  events: () => ["dashboard", "notify", "events"] as const,
};

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
