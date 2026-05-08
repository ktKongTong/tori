import { useQuery } from "@tanstack/react-query";

import {getTasks, getTaskDetail, getTaskRuns} from "./api";

export const tasksQueryKeys = {
  tasks: () => ["tasks"] as const,
  task: (taskId: string) => ["task", taskId],
  taskRuns: (taskId: string, pagination: { page: number; pageSize: number }) =>
    ["tasks", taskId, pagination] as const,
};

export function useTasksQuery() {
  return useQuery({
    queryKey: tasksQueryKeys.tasks(),
    queryFn: getTasks,
    staleTime: 0,
    refetchOnWindowFocus: true,
  });
}

function getTaskConnectionId(payload: unknown): string | null {
  if (!payload || typeof payload !== "object" || Array.isArray(payload)) {
    return null;
  }

  const value = (payload as Record<string, unknown>).connectionId;
  return typeof value === "string" ? value : null;
}

export function useTaskDetailQuery(taskId: string) {
  return useQuery({
    queryKey: tasksQueryKeys.task(taskId),
    queryFn: () => getTaskDetail(taskId),
    staleTime: 0,
    refetchOnWindowFocus: true,
  });
}

export function useTaskRuns(taskId: string, pagination: { page: number; pageSize: number }) {
  return useQuery({
    queryKey: tasksQueryKeys.taskRuns(taskId, pagination),
    queryFn: () => getTaskRuns(taskId, pagination),
    staleTime: 0,
    refetchOnWindowFocus: true,
  });
}