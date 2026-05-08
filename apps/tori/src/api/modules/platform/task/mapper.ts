import type { PageBasedPaginationResult } from "@repo/utils/schema/paging";
import type { TaskDefinition, TaskRun } from "@/api/modules/platform/task/repository/repository.ts";
import type { TaskDefinitionDto, TaskRunDto } from "@/api/modules/platform/task/contract";

function toIso(value: Date | string | null | undefined): string | null {
  if (!value) return null;
  return value instanceof Date ? value.toISOString() : value;
}

export function toTaskDefinitionDto(taskDefinition: TaskDefinition): TaskDefinitionDto {
  return {
    id: taskDefinition.id,
    ownerUserId: taskDefinition.ownerUserId ?? null,
    enabled: taskDefinition.enabled,
    kind: taskDefinition.kind,
    schedule: taskDefinition.schedule,
    payload: taskDefinition.payload,
    lastTriggeredAt: toIso(taskDefinition.lastTriggeredAt),
    lastRunAt: toIso(taskDefinition.lastRunAt),
    lastRunStatus: taskDefinition.lastRunStatus ?? null,
    lastError: taskDefinition.lastError ?? null,
    metadata: "metadata" in taskDefinition ? (taskDefinition.metadata ?? null) : null,
    createdAt: toIso(taskDefinition.createdAt) ?? new Date(0).toISOString(),
    updatedAt: toIso(taskDefinition.updatedAt) ?? new Date(0).toISOString(),
  };
}

export function toTaskRunDto(taskRun: TaskRun): TaskRunDto {
  return {
    id: taskRun.id,
    kind: taskRun.kind,
    scheduledFor: toIso(taskRun.scheduledFor),
    errorMessage: taskRun.errorMessage ?? null,
    startedAt: toIso(taskRun.startedAt),
    finishedAt: toIso(taskRun.finishedAt),
    createdAt: toIso(taskRun.createdAt) ?? new Date(0).toISOString(),
    status: taskRun.status,
    summary: taskRun.summary ?? null,
    taskDefinitionId: taskRun.taskDefinitionId,
  };
}

export function mapTaskDefinitionPage(
  page: PageBasedPaginationResult<TaskDefinition>,
): PageBasedPaginationResult<TaskDefinitionDto> {
  return {
    ...page,
    data: page.data.map(toTaskDefinitionDto),
  };
}

export function mapTaskRunPage(
  page: PageBasedPaginationResult<TaskRun>,
): PageBasedPaginationResult<TaskRunDto> {
  return {
    ...page,
    data: page.data.map(toTaskRunDto),
  };
}
