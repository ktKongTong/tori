import { createRequestClient } from "@repo/request";
import { z } from "zod";

const tasksRequest = createRequestClient({
  credentials: "include",
  retry: 0,
  timeout: 10000,
  headers: {
    accept: "application/json",
  },
});

export const dashboardTasksSchema = z.object({
  tasks: z.array(
    z.object({
      id: z.string(),
      kind: z.string(),
      schedule: z.string(),
      enabled: z.boolean(),
      connectionId: z.string().nullable(),
      connectionLabel: z.string().nullable(),
      lastRunStatus: z.string().nullable(),
    }),
  ),
});

export const dashboardTaskDetailSchema = z.object({
  task: z.object({
    id: z.string(),
    kind: z.string(),
    schedule: z.string(),
    enabled: z.boolean(),
    connectionId: z.string().nullable(),
    connectionLabel: z.string().nullable(),
    lastRunStatus: z.string().nullable(),
    lastTriggeredAt: z.string().nullable(),
    lastRunAt: z.string().nullable(),
    lastError: z.string().nullable(),
    createdAt: z.string(),
    updatedAt: z.string(),
  }),
  runs: z.array(
    z.object({
      id: z.string(),
      taskDefinitionId: z.string(),
      kind: z.string(),
      status: z.string(),
      summary: z.unknown().nullable(),
      errorMessage: z.string().nullable(),
      scheduledFor: z.string().nullable(),
      startedAt: z.string().nullable(),
      finishedAt: z.string().nullable(),
      createdAt: z.string(),
    }),
  ),
  pagination: z.object({
    page: z.number(),
    pageSize: z.number(),
    total: z.number(),
    totalPages: z.number(),
  }),
});

export type DashboardTasksData = z.infer<typeof dashboardTasksSchema>;
export type DashboardTaskDetailData = z.infer<typeof dashboardTaskDetailSchema>;

export const getTasks = () =>
  tasksRequest.get("/api/dashboard/tasks", {
    schema: dashboardTasksSchema,
  });

export const getTaskDetail = (
  taskId: string,
  input: { page: number; pageSize: number } = { page: 1, pageSize: 10 },
) =>
  tasksRequest.get(`/api/dashboard/tasks/${encodeURIComponent(taskId)}`, {
    query: input,
    schema: dashboardTaskDetailSchema,
  });
