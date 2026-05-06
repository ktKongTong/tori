/* oxlint-disable typescript-eslint/no-redundant-type-constituents */

import { and, eq } from "drizzle-orm";
import { taskDefinitions, taskRuns } from "@/api/db/schema/d1";
import type { SqliteDB } from "@/api/domain/infra";
import type {
  CreateTaskDefinitionInput,
  CreateTaskRunInput,
  ITaskRepository,
  JsonRecord,
  UpdateTaskDefinitionInput,
} from "@/api/domain/infra/repository/ports/task.ts";

export class TaskSqliteRepository implements ITaskRepository {
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
    return await this.db.select().from(taskDefinitions).where(eq(taskDefinitions.enabled, 1));
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

  async markTaskRunDone(
    taskRunId: string,
    input: { summary?: JsonRecord | null; finishedAt: Date },
  ) {
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
    const [taskDefinition] = await this.db
      .insert(taskDefinitions)
      .values(input as typeof taskDefinitions.$inferInsert)
      .returning();
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
    const [taskRun] = await this.db
      .insert(taskRuns)
      .values(input as typeof taskRuns.$inferInsert)
      .returning();
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
