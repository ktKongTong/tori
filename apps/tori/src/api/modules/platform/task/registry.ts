import { NotFoundError, ParameterError } from "@/api/domain/error";
import type { ServiceContext } from "@/api/domain/infra/service-context";
import type { TaskDefinition, TaskRun } from "@/api/modules/platform/task/repository/repository.ts";

export interface TaskHandlerResult {
  summary?: Record<string, unknown> | null;
}

export type TaskHandler = (
  ctx: ServiceContext,
  taskDefinition: TaskDefinition,
  taskRun: TaskRun,
) => Promise<TaskHandlerResult | void>;
export interface TaskHandlerDefinition {
  id: string;
  handler: TaskHandler;
}

const handlers = new Map<string, TaskHandler>();

export function defineTaskHandler(id: string, handler: TaskHandler): TaskHandlerDefinition {
  return { id, handler };
}

export function registerTaskHandlers(...definitions: TaskHandlerDefinition[]) {
  for (const definition of definitions) {
    if (handlers.has(definition.id)) {
      throw new Error(`TaskHandler already registered for kind: ${definition.id}`);
    }

    handlers.set(definition.id, definition.handler);
  }
}

export function hasTaskHandler(kind: string) {
  return handlers.has(kind);
}

export async function handleTaskRun(ctx: ServiceContext, taskRunId: string) {
  const taskRun = await ctx.repositories.task.getTaskRunById(taskRunId);
  if (!taskRun) {
    throw new NotFoundError("task run not found");
  }
  if (taskRun.status !== "PENDING") {
    return;
  }

  const taskDefinition = await ctx.repositories.task.getTaskDefinitionById(
    taskRun.taskDefinitionId,
  );
  if (!taskDefinition) {
    throw new NotFoundError("task definition not found");
  }
  if (!taskDefinition.enabled) {
    await ctx.repositories.task.markTaskRunFailed(taskRun.id, {
      errorMessage: "task definition is disabled",
      finishedAt: new Date(),
    });
    return;
  }

  const handler = handlers.get(taskDefinition.kind);
  if (!handler) {
    throw new ParameterError(`unsupported task kind: ${taskDefinition.kind}`);
  }

  await ctx.repositories.task.markTaskRunProcessing(taskRun.id, new Date());

  try {
    const result = await handler(ctx, taskDefinition, taskRun);
    const finishedAt = new Date();

    await ctx.repositories.task.markTaskRunDone(taskRun.id, {
      summary: result?.summary ?? null,
      finishedAt,
    });
    await ctx.repositories.task.markTaskDefinitionRunDone(taskDefinition.id, {
      triggeredAt: taskRun.scheduledFor ?? finishedAt,
      finishedAt,
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    const finishedAt = new Date();

    await ctx.repositories.task.markTaskRunFailed(taskRun.id, {
      errorMessage: message,
      finishedAt,
    });
    await ctx.repositories.task.markTaskDefinitionRunFailed(taskDefinition.id, {
      triggeredAt: taskRun.scheduledFor ?? finishedAt,
      finishedAt,
      errorMessage: message,
    });

    throw error;
  }
}
