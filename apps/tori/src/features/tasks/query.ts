import { useQuery } from "@tanstack/react-query";

import { getTaskDetail, getTasks } from "./api";

export const tasksQueryKeys = {
  tasks: () => ["dashboard", "tasks"] as const,
  taskDetail: (taskId: string, page: number, pageSize: number) =>
    ["dashboard", "tasks", taskId, page, pageSize] as const,
};

export function useDashboardTasksQuery() {
  return useQuery({
    queryKey: tasksQueryKeys.tasks(),
    queryFn: getTasks,
    staleTime: 0,
    refetchOnWindowFocus: true,
  });
}

export function useDashboardTaskDetailQuery(
  taskId: string,
  input: { page: number; pageSize: number },
) {
  return useQuery({
    queryKey: tasksQueryKeys.taskDetail(taskId, input.page, input.pageSize),
    queryFn: () => getTaskDetail(taskId, input),
    staleTime: 0,
    refetchOnWindowFocus: true,
  });
}
