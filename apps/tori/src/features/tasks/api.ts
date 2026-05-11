import { createRequestClient } from "@repo/request";
import {
  taskDefinitionDtoSchema,
  taskDefinitionPageDtoSchema,
  taskRunPageDtoSchema,
  type UpdateTaskDto,
} from "@/api/modules/platform/task/contract";

const tasksRequest = createRequestClient({
  credentials: "include",
  retry: 0,
  timeout: 10000,
  headers: {
    accept: "application/json",
  },
});

export const getTasks = () =>
  tasksRequest.get("/api/tasks", {
    schema: taskDefinitionPageDtoSchema,
  });

export const getTaskDetail = async (taskId: string) => {
  return tasksRequest.get(`/api/tasks/${encodeURIComponent(taskId)}`, {
    schema: taskDefinitionDtoSchema,
  });
};

export const getTaskRuns = async (
  taskId: string,
  input: { page: number; pageSize: number } = { page: 1, pageSize: 10 },
) => {
  return tasksRequest.get(`/api/tasks/${encodeURIComponent(taskId)}/runs`, {
    query: input,
    schema: taskRunPageDtoSchema,
  });
};

export const updateTaskDefinition = async (taskId: string, input: UpdateTaskDto) => {
  return tasksRequest.patch(`/api/tasks/${encodeURIComponent(taskId)}`, input, {
    schema: taskDefinitionDtoSchema,
  });
};

export const deleteTaskDefinition = async (taskId: string) => {
  return tasksRequest.delete(`/api/tasks/${encodeURIComponent(taskId)}`, {
    schema: taskDefinitionDtoSchema,
  });
};
