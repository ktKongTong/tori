import type { TaskAttempt, TaskEnvelope, TaskPartition } from "./schema.ts";

export type CreateTaskEnvelopeInput<TPayload> = {
  taskId: string;
  taskType: string;
  payload: TPayload;
  createdAt?: Date;
  scheduledAt?: Date;
  attempt?: TaskAttempt;
  partition?: TaskPartition;
  traceId?: string;
};

export type TypedTaskEnvelope<TPayload> = Omit<TaskEnvelope, "payload"> & {
  payload: TPayload;
};

export function createTaskEnvelope<TPayload>(
  input: CreateTaskEnvelopeInput<TPayload>,
): TypedTaskEnvelope<TPayload> {
  return {
    taskId: input.taskId,
    taskType: input.taskType,
    payload: input.payload,
    createdAt: (input.createdAt ?? new Date()).toISOString(),
    scheduledAt: input.scheduledAt?.toISOString(),
    attempt: input.attempt,
    partition: input.partition,
    traceId: input.traceId,
  };
}

export function taskEntryId(envelope: Pick<TaskEnvelope, "taskId" | "partition">) {
  return envelope.partition ? `${envelope.taskId}:${envelope.partition.key}` : envelope.taskId;
}
