import type {
  PageBasedPaginationParam,
  PageBasedPaginationResult,
} from "@repo/utils/schema/paging";

export interface TaskDefinition {
  id: string;
  ownerUserId: string | null;
  kind: string;
  enabled: boolean;
  schedule: string;
  payload: unknown;
  lastTriggeredAt: Date | null;
  lastRunAt: Date | null;
  lastRunStatus: string | null;
  lastError: string | null;
  metadata: unknown;
  deletedAt: Date | null;
  createdAt: Date;
  updatedAt: Date;
}

export interface TaskRun {
  id: string;
  taskDefinitionId: string;
  kind: string;
  status: string;
  summary: unknown;
  errorMessage: string | null;
  scheduledFor: Date | null;
  startedAt: Date | null;
  finishedAt: Date | null;
  createdAt: Date;
}

export interface CreateTaskDefinitionInput {
  id?: string;
  ownerUserId?: string | null;
  kind: string;
  enabled?: boolean;
  schedule: string;
  payload: unknown;
  metadata?: unknown;
}

export interface UpdateTaskDefinitionInput {
  enabled?: boolean;
  schedule?: string;
  payload?: unknown;
  metadata?: unknown;
}

export interface CreateTaskRunInput {
  id?: string;
  taskDefinitionId: string;
  kind: string;
  status?: string;
  scheduledFor?: Date | null;
}

export interface ITaskRepository {
  listTasks(page: PageBasedPaginationParam): Promise<PageBasedPaginationResult<TaskDefinition>>;
  getTaskDefinitionsByKind(
    kind: string,
    userId: string | null,
    page: PageBasedPaginationParam,
  ): Promise<PageBasedPaginationResult<TaskDefinition>>;
  listTaskDefinitionsByOwner(
    ownerUserId: string,
    page: PageBasedPaginationParam,
  ): Promise<PageBasedPaginationResult<TaskDefinition>>;
  listEnabledTaskDefinitions(
    page: PageBasedPaginationParam,
  ): Promise<PageBasedPaginationResult<TaskDefinition>>;
  getTaskRunByTaskDefinitionId(
    taskDefinitionId: string,
    page: PageBasedPaginationParam,
  ): Promise<PageBasedPaginationResult<TaskRun>>;
  getTaskRunById(taskRunId: string): Promise<TaskRun | null>;
  getTaskDefinitionById(taskDefinitionId: string): Promise<TaskDefinition | null>;
  markTaskRunProcessing(taskRunId: string, startedAt: Date): Promise<void>;
  markTaskRunDone(taskRunId: string, input: { summary?: unknown; finishedAt: Date }): Promise<void>;
  markTaskRunFailed(
    taskRunId: string,
    input: { errorMessage: string; finishedAt: Date },
  ): Promise<void>;
  markTaskDefinitionRunDone(
    taskDefinitionId: string,
    input: { triggeredAt: Date; finishedAt: Date },
  ): Promise<void>;
  markTaskDefinitionRunFailed(
    taskDefinitionId: string,
    input: { triggeredAt: Date; finishedAt: Date; errorMessage: string },
  ): Promise<void>;
  createTaskDefinition(input: CreateTaskDefinitionInput): Promise<TaskDefinition>;
  updateTaskDefinition(
    taskDefinitionId: string,
    input: UpdateTaskDefinitionInput,
  ): Promise<TaskDefinition | null>;
  createTaskRun(input: CreateTaskRunInput): Promise<TaskRun>;
  markTaskDefinitionTriggered(taskDefinitionId: string, triggeredAt: Date): Promise<void>;
  disableTaskDefinitionsByPayloadConnectionId(connectionId: string): Promise<string[]>;
  cancelPendingTaskRunsByTaskDefinitionIds(taskDefinitionIds: string[]): Promise<number>;
  deleteTaskDefinition(taskDefinitionId: string): Promise<TaskDefinition | null>;
  deleteTaskDefinitionsByPayloadConnectionId(connectionId: string): Promise<string[]>;
  deleteTaskRunsByTaskDefinitionIds(taskDefinitionIds: string[]): Promise<number>;
}
