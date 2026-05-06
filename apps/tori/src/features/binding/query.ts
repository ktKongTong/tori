import { useQuery } from "@tanstack/react-query";

import { getBinding } from "./api";

export const bindingQueryKeys = {
  binding: () => ["dashboard", "binding"] as const,
};

export function useDashboardBindingQuery() {
  return useQuery({
    queryKey: bindingQueryKeys.binding(),
    queryFn: getBinding,
    staleTime: 0,
    refetchOnWindowFocus: true,
  });
}
