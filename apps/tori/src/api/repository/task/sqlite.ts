/* oxlint-disable typescript-eslint/no-redundant-type-constituents */

import { and, eq, desc, count } from "drizzle-orm";
import { taskDefinitions, taskRuns } from "@/api/db/schema/d1";
import type { SqliteDB } from "@/api/domain/infra";
import type {
  CreateTaskDefinitionInput,
  CreateTaskRunInput,
  ITaskRepository,
  UpdateTaskDefinitionInput,
} from "@/api/domain/infra/repository/ports/task.ts";

export class TaskSqliteRepository implements ITaskRepository {
  async listTasks() {
    return this.db
      .select()
      .from(taskDefinitions)
      .orderBy(desc(taskDefinitions.createdAt))
      .limit(100);
  }

  async getTaskDetail(taskDefinitionId: string, input: { limit: number; offset: number }) {
    const [task] = await this.db
      .select()
      .from(taskDefinitions)
      .where(eq(taskDefinitions.id, taskDefinitionId))
      .limit(1);
    if (!task) return null;

    const runs = await this.db
      .select()
      .from(taskRuns)
      .where(eq(taskRuns.taskDefinitionId, taskDefinitionId))
      .orderBy(desc(taskRuns.createdAt))
      .limit(input.limit)
      .offset(input.offset);

    const [{ value: totalRuns }] = await this.db
      .select({ value: count() })
      .from(taskRuns)
      .where(eq(taskRuns.taskDefinitionId, taskDefinitionId));

    return {
      task,
      runs,
      totalRuns,
    };
  }

  constructor(private db: SqliteDB) {}

  async getTaskDefinitionsByKind(kind: string, userId?: string | null) {
    return await this.db
      .select()
      .from(taskDefinitions)
      .where(
        and(
          eq(taskDefinitions.kind, kind),
          userId ? eq(taskDefinitions.ownerUserId, userId) : undefined,
        ),
      );
  }

  async listTaskDefinitionsByOwner(ownerUserId: string) {
    return await this.db
      .select()
      .from(taskDefinitions)
      .where(eq(taskDefinitions.ownerUserId, ownerUserId));
  }

  async listEnabledTaskDefinitions() {
    return await this.db.select().from(taskDefinitions).where(eq(taskDefinitions.enabled, true));
  }

  async getTaskRunById(taskRunId: string) {
    const [taskRun] = await this.db
      .select()
      .from(taskRuns)
      .where(eq(taskRuns.id, taskRunId))
      .limit(1);
    return taskRun ?? null;
  }

  async getTaskDefinitionById(taskDefinitionId: string) {
    const [taskDefinition] = await this.db
      .select()
      .from(taskDefinitions)
      .where(eq(taskDefinitions.id, taskDefinitionId))
      .limit(1);
    return taskDefinition ?? null;
  }

  async markTaskRunProcessing(taskRunId: string, startedAt: Date) {
    await this.db
      .update(taskRuns)
      .set({ status: "PROCESSING", startedAt })
      .where(eq(taskRuns.id, taskRunId));
  }

  async markTaskRunDone(taskRunId: string, input: { summary?: unknown; finishedAt: Date }) {
    await this.db
      .update(taskRuns)
      .set({
        status: "DONE",
        summary: input.summary ?? null,
        errorMessage: null,
        finishedAt: input.finishedAt,
      })
      .where(eq(taskRuns.id, taskRunId));
  }

  async markTaskRunFailed(taskRunId: string, input: { errorMessage: string; finishedAt: Date }) {
    await this.db
      .update(taskRuns)
      .set({ status: "FAIL", errorMessage: input.errorMessage, finishedAt: input.finishedAt })
      .where(eq(taskRuns.id, taskRunId));
  }

  async markTaskDefinitionRunDone(
    taskDefinitionId: string,
    input: { triggeredAt: Date; finishedAt: Date },
  ) {
    await this.db
      .update(taskDefinitions)
      .set({
        lastTriggeredAt: input.triggeredAt,
        lastRunAt: input.finishedAt,
        lastRunStatus: "DONE",
        lastError: null,
        updatedAt: input.finishedAt,
      })
      .where(eq(taskDefinitions.id, taskDefinitionId));
  }

  async markTaskDefinitionRunFailed(
    taskDefinitionId: string,
    input: { triggeredAt: Date; finishedAt: Date; errorMessage: string },
  ) {
    await this.db
      .update(taskDefinitions)
      .set({
        lastTriggeredAt: input.triggeredAt,
        lastRunAt: input.finishedAt,
        lastRunStatus: "FAIL",
        lastError: input.errorMessage,
        updatedAt: input.finishedAt,
      })
      .where(eq(taskDefinitions.id, taskDefinitionId));
  }

  async createTaskDefinition(input: CreateTaskDefinitionInput) {
    const values: typeof taskDefinitions.$inferInsert = {
      id: input.id,
      ownerUserId: input.ownerUserId ?? null,
      kind: input.kind,
      enabled: input.enabled ?? true,
      schedule: input.schedule,
      payload: input.payload,
      metadata: input.metadata ?? null,
    };
    const [taskDefinition] = await this.db.insert(taskDefinitions).values(values).returning();
    return taskDefinition;
  }

  async updateTaskDefinition(taskDefinitionId: string, input: UpdateTaskDefinitionInput) {
    const [taskDefinition] = await this.db
      .update(taskDefinitions)
      .set({ ...input, updatedAt: new Date() })
      .where(eq(taskDefinitions.id, taskDefinitionId))
      .returning();
    return taskDefinition ?? null;
  }

  async createTaskRun(input: CreateTaskRunInput) {
    const values = {
      id: input.id,
      taskDefinitionId: input.taskDefinitionId,
      kind: input.kind,
      status: input.status ?? "PENDING",
      scheduledFor: input.scheduledFor ?? null,
    };
    const [taskRun] = await this.db.insert(taskRuns).values(values).returning();
    return taskRun;
  }

  async markTaskDefinitionTriggered(taskDefinitionId: string, triggeredAt: Date) {
    await this.db
      .update(taskDefinitions)
      .set({
        lastTriggeredAt: triggeredAt,
        updatedAt: new Date(),
      })
      .where(eq(taskDefinitions.id, taskDefinitionId));
  }
}
