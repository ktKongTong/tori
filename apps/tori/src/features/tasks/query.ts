import { useQuery } from "@tanstack/react-query";

import { getTasks } from "./api";

export const tasksQueryKeys = {
  tasks: () => ["dashboard", "tasks"] as const,
};

export function useDashboardTasksQuery() {
  return useQuery({
    queryKey: tasksQueryKeys.tasks(),
    queryFn: getTasks,
    staleTime: 0,
    refetchOnWindowFocus: true,
  });
}
