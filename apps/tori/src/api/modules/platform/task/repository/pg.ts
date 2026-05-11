import { and, eq, inArray, sql } from "drizzle-orm";
import { taskDefinitions, taskRuns } from "@/api/db/schema/pg";
import type { PGDB } from "@/api/domain/infra";
import type {
  CreateTaskDefinitionInput,
  CreateTaskRunInput,
  ITaskRepository,
  UpdateTaskDefinitionInput,
} from "@/api/modules/platform/task/repository/repository.ts";
import type { PageBasedPaginationParam } from "@repo/utils/schema/paging";
import { list } from "@repo/db/utils/pg";
import { NotFoundError } from "@/api/domain/error";

export class TaskPgRepository implements ITaskRepository {
  constructor(private db: PGDB) {}

  async listTasks(page: PageBasedPaginationParam) {
    return list(this.db, taskDefinitions, {
      orderBy: [{ column: "createdAt", direction: "desc" }],
      page,
    });
  }
  async getTaskDefinitionsByKind(
    kind: string,
    userId: string | null,
    page: PageBasedPaginationParam,
  ) {
    const where = and(
      eq(taskDefinitions.kind, kind),
      userId ? eq(taskDefinitions.ownerUserId, userId) : undefined,
    );

    return list(this.db, taskDefinitions, { where, page });
  }

  async getTaskRunByTaskDefinitionId(taskDefinitionId: string, page: PageBasedPaginationParam) {
    const [task] = await this.db
      .select()
      .from(taskDefinitions)
      .where(eq(taskDefinitions.id, taskDefinitionId))
      .limit(1);
    if (!task) throw new NotFoundError(`NotFound task definition: ${taskDefinitionId}`);

    const where = eq(taskRuns.taskDefinitionId, taskDefinitionId);
    return list(this.db, taskRuns, {
      where,
      orderBy: [{ column: "createdAt", direction: "desc" }],
      page,
    });
  }

  async listTaskDefinitionsByOwner(ownerUserId: string, page: PageBasedPaginationParam) {
    const where = eq(taskDefinitions.ownerUserId, ownerUserId);
    return list(this.db, taskDefinitions, {
      where,
      orderBy: [{ column: "createdAt", direction: "desc" }],
      page,
    });
  }

  async listEnabledTaskDefinitions(page: PageBasedPaginationParam) {
    return list(this.db, taskDefinitions, { where: eq(taskDefinitions.enabled, true), page });
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
    const [taskDefinition] = await this.db.insert(taskDefinitions).values(input).returning();
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
    const values: typeof taskRuns.$inferInsert = {
      id: input.id,
      taskDefinitionId: input.taskDefinitionId,
      kind: input.kind,
      status: input.status ?? "PENDING",
      scheduledFor: input.scheduledFor ?? undefined,
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

  async disableTaskDefinitionsByPayloadConnectionId(connectionId: string) {
    const rows = await this.db
      .update(taskDefinitions)
      .set({
        enabled: false,
        updatedAt: new Date(),
      })
      .where(
        and(
          eq(taskDefinitions.enabled, true),
          sql`${taskDefinitions.payload}->>'connectionId' = ${connectionId}`,
        ),
      )
      .returning({ id: taskDefinitions.id });
    return rows.map((row) => row.id);
  }

  async cancelPendingTaskRunsByTaskDefinitionIds(taskDefinitionIds: string[]) {
    if (!taskDefinitionIds.length) return 0;
    const rows = await this.db
      .update(taskRuns)
      .set({
        status: "CANCELLED",
        errorMessage: "task cancelled because upstream resource was disabled or removed",
        finishedAt: new Date(),
      })
      .where(
        and(inArray(taskRuns.taskDefinitionId, taskDefinitionIds), eq(taskRuns.status, "PENDING")),
      )
      .returning({ id: taskRuns.id });
    return rows.length;
  }

  async deleteTaskDefinition(taskDefinitionId: string) {
    const [row] = await this.db
      .update(taskDefinitions)
      .set({
        enabled: false,
        metadata: sql`coalesce(${taskDefinitions.metadata}, '{}'::jsonb) || jsonb_build_object('deletedAt', ${new Date().toISOString()})`,
        updatedAt: new Date(),
      })
      .where(eq(taskDefinitions.id, taskDefinitionId))
      .returning();
    return row ?? null;
  }

  async deleteTaskDefinitionsByPayloadConnectionId(connectionId: string) {
    const rows = await this.db
      .update(taskDefinitions)
      .set({
        enabled: false,
        metadata: sql`coalesce(${taskDefinitions.metadata}, '{}'::jsonb) || jsonb_build_object('deletedAt', ${new Date().toISOString()}, 'deletedByLifecycle', true)`,
        updatedAt: new Date(),
      })
      .where(sql`${taskDefinitions.payload}->>'connectionId' = ${connectionId}`)
      .returning({ id: taskDefinitions.id });
    return rows.map((row) => row.id);
  }

  async deleteTaskRunsByTaskDefinitionIds(taskDefinitionIds: string[]) {
    if (!taskDefinitionIds.length) return 0;
    const rows = await this.db
      .delete(taskRuns)
      .where(inArray(taskRuns.taskDefinitionId, taskDefinitionIds))
      .returning({ id: taskRuns.id });
    return rows.length;
  }
}
