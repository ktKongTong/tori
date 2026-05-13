import { and, eq, desc, count, inArray, sql } from "drizzle-orm";
import { taskDefinitions, taskRuns } from "@/api/db/schema/d1";
import type { SqliteDB } from "@/api/domain/infra";
import type {
  CreateTaskDefinitionInput,
  CreateTaskRunInput,
  ITaskRepository,
  UpdateTaskDefinitionInput,
} from "@/api/modules/platform/task/repository/repository.ts";
import { NotFoundError } from "@/api/domain/error";
import { toPageResult } from "@repo/db/utils";
import { withPagination } from "@repo/db/utils/sqlite";
import type { PageBasedPaginationParam } from "@repo/utils/schema/paging";

export class TaskSqliteRepository implements ITaskRepository {
  async listTasks(page: PageBasedPaginationParam) {
    const [data, [{ value: total }]] = await Promise.all([
      withPagination(
        this.db.select().from(taskDefinitions).orderBy(desc(taskDefinitions.createdAt)).$dynamic(),
        page,
      ),
      this.db.select({ value: count() }).from(taskDefinitions),
    ]);
    return toPageResult(data, total ?? 0, page);
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

  async getTaskDefinitionsByKind(
    kind: string,
    userId: string | null,
    page: PageBasedPaginationParam,
  ) {
    const where = and(
      eq(taskDefinitions.kind, kind),
      userId ? eq(taskDefinitions.ownerUserId, userId) : undefined,
    );
    const [data, [{ value: total }]] = await Promise.all([
      withPagination(this.db.select().from(taskDefinitions).where(where).$dynamic(), page),
      this.db.select({ value: count() }).from(taskDefinitions).where(where),
    ]);
    return toPageResult(data, total ?? 0, page);
  }

  async getTaskRunByTaskDefinitionId(taskDefinitionId: string, page: PageBasedPaginationParam) {
    const [task] = await this.db
      .select()
      .from(taskDefinitions)
      .where(eq(taskDefinitions.id, taskDefinitionId))
      .limit(1);
    if (!task) throw new NotFoundError(`NotFound task definition: ${taskDefinitionId}`);

    const where = eq(taskRuns.taskDefinitionId, taskDefinitionId);
    const [data, [{ value: total }]] = await Promise.all([
      withPagination(
        this.db.select().from(taskRuns).where(where).orderBy(desc(taskRuns.createdAt)).$dynamic(),
        page,
      ),
      this.db.select({ value: count() }).from(taskRuns).where(where),
    ]);
    return toPageResult(data, total ?? 0, page);
  }

  async listTaskDefinitionsByOwner(ownerUserId: string, page: PageBasedPaginationParam) {
    const where = eq(taskDefinitions.ownerUserId, ownerUserId);
    const [data, [{ value: total }]] = await Promise.all([
      withPagination(
        this.db
          .select()
          .from(taskDefinitions)
          .where(where)
          .orderBy(desc(taskDefinitions.createdAt))
          .$dynamic(),
        page,
      ),
      this.db.select({ value: count() }).from(taskDefinitions).where(where),
    ]);
    return toPageResult(data, total ?? 0, page);
  }

  async listEnabledTaskDefinitions(page: PageBasedPaginationParam) {
    const where = eq(taskDefinitions.enabled, true);
    const [data, [{ value: total }]] = await Promise.all([
      withPagination(this.db.select().from(taskDefinitions).where(where).$dynamic(), page),
      this.db.select({ value: count() }).from(taskDefinitions).where(where),
    ]);
    return toPageResult(data, total ?? 0, page);
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

  async listTaskDefinitionsByMetadataSubscriptionId(subscriptionId: string) {
    return this.db
      .select()
      .from(taskDefinitions)
      .where(
        sql`json_extract(${taskDefinitions.metadata}, '$.subscriptionId') = ${subscriptionId}`,
      );
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

  async disableTaskDefinitionsByMetadataSubscriptionId(subscriptionId: string) {
    const rows = await this.db
      .update(taskDefinitions)
      .set({
        enabled: false,
        updatedAt: new Date(),
      })
      .where(
        and(
          eq(taskDefinitions.enabled, true),
          sql`json_extract(${taskDefinitions.metadata}, '$.subscriptionId') = ${subscriptionId}`,
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
        errorMessage: "task cancelled because connection was removed",
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
      .delete(taskDefinitions)
      .where(eq(taskDefinitions.id, taskDefinitionId))
      .returning();
    return row ?? null;
  }

  async deleteTaskDefinitionsByPayloadConnectionId(connectionId: string) {
    const rows = await this.db
      .delete(taskDefinitions)
      .where(sql`json_extract(${taskDefinitions.payload}, '$.connectionId') = ${connectionId}`)
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
