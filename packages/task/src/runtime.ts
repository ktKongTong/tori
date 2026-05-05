import { nextRetryDelayMs, shouldRetry, type RetryPolicy } from "./retry.ts";
import {
  createTaskRegistry,
  type TaskHandler,
  type TaskRegistry,
  type TaskRunContext,
  type TaskRunResult,
} from "./registry.ts";
import type { TaskEnvelope } from "./schema.ts";

export type TaskRuntimeOptions = {
  handlers?: Record<string, TaskHandler>;
  registry?: TaskRegistry;
  retryPolicy?: RetryPolicy;
  now?: () => Date;
  random?: () => number;
  onSuccess?: (result: TaskRunResult) => Promise<void> | void;
  onFailure?: (result: TaskRunResult) => Promise<void> | void;
};

export type TaskRuntime = {
  readonly registry: TaskRegistry;
  register(taskType: string, handler: TaskHandler): void;
  run<TResult = unknown>(task: TaskEnvelope): Promise<TaskRunResult<TResult>>;
};

export function createTaskRuntime(options: TaskRuntimeOptions = {}): TaskRuntime {
  const registry = options.registry ?? createTaskRegistry(options.handlers);
  const now = options.now ?? (() => new Date());
  const context: TaskRunContext = { now };

  return {
    registry,
    register(taskType, handler) {
      registry.register(taskType, handler);
    },
    async run<TResult>(task: TaskEnvelope): Promise<TaskRunResult<TResult>> {
      const startedAt = now();
      const handler = registry.get(task.taskType);
      if (!handler) {
        return failTask(
          task,
          startedAt,
          now(),
          new Error(`No handler registered for ${task.taskType}`),
        );
      }

      try {
        const result = (await handler(task, context)) as TResult;
        const output: TaskRunResult<TResult> = {
          taskId: task.taskId,
          taskType: task.taskType,
          status: "success",
          startedAt: startedAt.toISOString(),
          finishedAt: now().toISOString(),
          result,
        };
        await options.onSuccess?.(output);
        return output;
      } catch (error) {
        const output = failTask<TResult>(task, startedAt, now(), error, options);
        await options.onFailure?.(output);
        return output;
      }
    },
  };
}

function failTask<TResult>(
  task: TaskEnvelope,
  startedAt: Date,
  finishedAt: Date,
  error: unknown,
  options: Pick<TaskRuntimeOptions, "retryPolicy" | "random"> = {},
): TaskRunResult<TResult> {
  const output: TaskRunResult<TResult> = {
    taskId: task.taskId,
    taskType: task.taskType,
    status: "failed",
    startedAt: startedAt.toISOString(),
    finishedAt: finishedAt.toISOString(),
    error,
  };
  const attempt = task.attempt?.attempt ?? 1;
  if (options.retryPolicy && shouldRetry(attempt, options.retryPolicy)) {
    const delayMs = nextRetryDelayMs(attempt, options.retryPolicy, options.random);
    output.retry = {
      attempt: attempt + 1,
      delayMs,
      scheduledAt: new Date(finishedAt.getTime() + delayMs).toISOString(),
    };
  }
  return output;
}
