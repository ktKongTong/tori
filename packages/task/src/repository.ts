/* oxlint-disable typescript-eslint/no-redundant-type-constituents */

export type JsonRecord = unknown;

export interface TaskDefinitionRow {
  id: string;
  ownerUserId: string | null;
  kind: string;
  enabled: number;
  schedule: string;
  payload: JsonRecord;
  lastTriggeredAt: Date | null;
  lastRunAt: Date | null;
  lastRunStatus: string | null;
  lastError: string | null;
  metadata: JsonRecord | null;
  createdAt: Date;
  updatedAt: Date;
}

export interface TaskRunRow {
  id: string;
  taskDefinitionId: string;
  kind: string;
  status: string;
  summary: JsonRecord | null;
  errorMessage: string | null;
  scheduledFor: Date | null;
  startedAt: Date | null;
  finishedAt: Date | null;
  createdAt: Date;
}

export interface CreateTaskDefinitionInput {
  id: string;
  ownerUserId?: string | null;
  kind: string;
  enabled?: number;
  schedule: string;
  payload: JsonRecord;
  metadata?: JsonRecord | null;
}

export interface UpdateTaskDefinitionInput {
  enabled?: number;
  schedule?: string;
  payload?: JsonRecord;
  metadata?: JsonRecord | null;
}

export interface CreateTaskRunInput {
  id: string;
  taskDefinitionId: string;
  kind: string;
  status: string;
  summary?: JsonRecord | null;
  errorMessage?: string | null;
  scheduledFor?: Date | null;
  startedAt?: Date | null;
  finishedAt?: Date | null;
}

export interface ITaskRepository {
  getTaskDefinitionsByKind(kind: string, userId?: string | null): Promise<TaskDefinitionRow[]>;
  listTaskDefinitionsByOwner(ownerUserId: string): Promise<TaskDefinitionRow[]>;
  listEnabledTaskDefinitions(): Promise<TaskDefinitionRow[]>;
  getTaskRunById(taskRunId: string): Promise<TaskRunRow | null>;
  getTaskDefinitionById(taskDefinitionId: string): Promise<TaskDefinitionRow | null>;
  markTaskRunProcessing(taskRunId: string, startedAt: Date): Promise<void>;
  markTaskRunDone(
    taskRunId: string,
    input: { summary?: JsonRecord | null; finishedAt: Date },
  ): Promise<void>;
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
  createTaskDefinition(input: CreateTaskDefinitionInput): Promise<TaskDefinitionRow>;
  updateTaskDefinition(
    taskDefinitionId: string,
    input: UpdateTaskDefinitionInput,
  ): Promise<TaskDefinitionRow | null>;
  createTaskRun(input: CreateTaskRunInput): Promise<TaskRunRow>;
  markTaskDefinitionTriggered(taskDefinitionId: string, triggeredAt: Date): Promise<void>;
}
