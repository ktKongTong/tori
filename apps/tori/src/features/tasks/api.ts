import { createRequestClient } from "@repo/request";
import { z } from "zod";
import { taskRunSchema, taskDefinitionSchema } from "@/api/modules/platform/task/schema.ts";
import {PageBasedPaginationResultSchema} from "@repo/utils/schema/paging";

const tasksRequest = createRequestClient({
  credentials: "include",
  retry: 0,
  timeout: 10000,
  headers: {
    accept: "application/json",
  },
});

export type TaskDef =  z.infer<typeof taskDefinitionSchema>

export type TaskRun =  z.infer<typeof taskRunSchema>
export const getTasks = () =>
  tasksRequest.get("/api/tasks", {
    schema: PageBasedPaginationResultSchema(taskDefinitionSchema),
  });

export const getTaskDetail = async (
  taskId: string,
) => {
  return tasksRequest.get(`/api/tasks/${encodeURIComponent(taskId)}`, {
    schema: taskDefinitionSchema,
  });
}


export const getTaskRuns = async (
  taskId: string,
  input: { page: number; pageSize: number } = { page: 1, pageSize: 10 },
) => {
  return tasksRequest.get(`/api/tasks/${encodeURIComponent(taskId)}/runs`, {
    query: input,
    schema: PageBasedPaginationResultSchema(taskRunSchema),
  });
}

