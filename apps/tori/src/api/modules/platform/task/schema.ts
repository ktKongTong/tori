

import { z } from "zod";
import { cronSchema } from "@repo/utils/schema/cron";
export const taskDefinitionSchema = z.object({
  id: z.string(),
  ownerUserId: z.string().nullable().optional(),
  // owner: userSchema,
  enabled: z.boolean(),
  kind: z.string(),
  schedule: z.string(),
  payload: z.unknown(),
  lastTriggeredAt: z.string().nullable().optional(),
  lastRunAt: z.string().nullable().optional(),
  lastRunStatus: z.string().nullable().optional(),
  lastError: z.string().nullable().optional(),
  metadata: z.any().nullable().optional(),
  updatedAt: z.string().nullable().optional(),
});

const date = z.coerce.date()

export const taskRunSchema = z.object({
  id: z.string(),
  kind: z.string(),
  scheduledFor: date.nullable().optional(),
  errorMessage: z.string().nullable().optional(),
  startedAt: date.nullable().optional(),
  finishedAt: date.nullable().optional(),
  createdAt: date,
  status: z.string().nullable().optional(),
  summary: z.unknown(),
  taskDefinitionId: z.string(),
})

export const createTaskSchema = z.object({
  kind: z.string().min(1),
  enabled: z.boolean().optional(),
  schedule: cronSchema,
  payload: z.record(z.string(), z.unknown()),
  metadata: z.record(z.string(), z.unknown()).optional(),
});

export const updateTaskSchema = z.object({
  enabled: z.boolean().optional(),
  schedule: cronSchema.optional(),
  payload: z.record(z.string(), z.unknown()).optional(),
  metadata: z.record(z.string(), z.unknown()).optional(),
});

export const runTaskSchema = z.object({
  reason: z.string().optional(),
});

export const PaginationQuerySchema = z.object({
  page: z.coerce.number().int().min(1).default(1),
  pageSize: z.coerce.number().int().min(1).max(50).default(10),
});