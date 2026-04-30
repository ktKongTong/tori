import { z } from "zod";

export const taskStatusSchema = z.enum(["pending", "running", "success", "failed", "cancelled"]);

export const taskAttemptSchema = z.object({
  attempt: z.number().int().nonnegative(),
  maxAttempts: z.number().int().positive().optional(),
});

export const taskPartitionSchema = z.object({
  key: z.string(),
  index: z.number().int().nonnegative().optional(),
  total: z.number().int().positive().optional(),
});

export const taskEnvelopeSchema = z.object({
  taskId: z.string().min(1),
  taskType: z.string().min(1),
  payload: z.unknown(),
  createdAt: z.string().datetime(),
  scheduledAt: z.string().datetime().optional(),
  attempt: taskAttemptSchema.optional(),
  partition: taskPartitionSchema.optional(),
  traceId: z.string().optional(),
});

export type TaskStatus = z.infer<typeof taskStatusSchema>;
export type TaskAttempt = z.infer<typeof taskAttemptSchema>;
export type TaskPartition = z.infer<typeof taskPartitionSchema>;
export type TaskEnvelope = z.infer<typeof taskEnvelopeSchema>;
