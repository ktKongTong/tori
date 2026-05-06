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

export type DashboardTasksData = z.infer<typeof dashboardTasksSchema>;

export const getTasks = () =>
  tasksRequest.get("/api/dashboard/tasks", {
    schema: dashboardTasksSchema,
  });
