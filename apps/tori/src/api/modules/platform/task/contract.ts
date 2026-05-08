import { cronSchema } from "@repo/utils/schema/cron";
import {
  PageBasedPaginationParamSchema,
  PageBasedPaginationResultSchema,
} from "@repo/utils/schema/paging";
import { z } from "zod";

export const taskDefinitionDtoSchema = z.object({
  id: z.string(),
  ownerUserId: z.string().nullable(),
  enabled: z.boolean(),
  kind: z.string(),
  schedule: z.string(),
  payload: z.unknown(),
  lastTriggeredAt: z.string().nullable(),
  lastRunAt: z.string().nullable(),
  lastRunStatus: z.string().nullable(),
  lastError: z.string().nullable(),
  metadata: z.unknown().nullable(),
  createdAt: z.string(),
  updatedAt: z.string(),
});

export const taskRunDtoSchema = z.object({
  id: z.string(),
  kind: z.string(),
  scheduledFor: z.string().nullable(),
  errorMessage: z.string().nullable(),
  startedAt: z.string().nullable(),
  finishedAt: z.string().nullable(),
  createdAt: z.string(),
  status: z.string(),
  summary: z.unknown().nullable(),
  taskDefinitionId: z.string(),
});

export const createTaskDtoSchema = z.object({
  kind: z.string().min(1),
  enabled: z.boolean().optional(),
  schedule: cronSchema,
  payload: z.record(z.string(), z.unknown()),
  metadata: z.record(z.string(), z.unknown()).optional(),
});

export const updateTaskDtoSchema = z.object({
  enabled: z.boolean().optional(),
  schedule: cronSchema.optional(),
  payload: z.record(z.string(), z.unknown()).optional(),
  metadata: z.record(z.string(), z.unknown()).optional(),
});

export const runTaskDtoSchema = z.object({
  reason: z.string().optional(),
});

export const taskRunRequestedDtoSchema = z.object({
  taskRunId: z.string(),
  outboxEventId: z.string(),
});

export const taskDefinitionPageDtoSchema = PageBasedPaginationResultSchema(taskDefinitionDtoSchema);
export const taskRunPageDtoSchema = PageBasedPaginationResultSchema(taskRunDtoSchema);
export const taskPaginationQuerySchema = PageBasedPaginationParamSchema;

export type TaskDefinitionDto = z.infer<typeof taskDefinitionDtoSchema>;
export type TaskRunDto = z.infer<typeof taskRunDtoSchema>;
export type CreateTaskDto = z.infer<typeof createTaskDtoSchema>;
export type UpdateTaskDto = z.infer<typeof updateTaskDtoSchema>;
export type RunTaskDto = z.infer<typeof runTaskDtoSchema>;
export type TaskRunRequestedDto = z.infer<typeof taskRunRequestedDtoSchema>;
