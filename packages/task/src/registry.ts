import type { TaskEnvelope, TaskStatus } from "./schema.ts";

export type TaskRunContext = {
  now: () => Date;
};

export type TaskHandler<TPayload = unknown, TResult = unknown> = (
  task: Omit<TaskEnvelope, "payload"> & { payload: TPayload },
  context: TaskRunContext,
) => Promise<TResult> | TResult;

export type TaskRegistry = {
  get(taskType: string): TaskHandler | undefined;
  register(taskType: string, handler: TaskHandler): void;
  entries(): IterableIterator<[string, TaskHandler]>;
};

export type TaskRunResult<TResult = unknown> = {
  taskId: string;
  taskType: string;
  status: Extract<TaskStatus, "success" | "failed">;
  startedAt: string;
  finishedAt: string;
  result?: TResult;
  error?: unknown;
  retry?: {
    attempt: number;
    delayMs: number;
    scheduledAt: string;
  };
};

export function createTaskRegistry(
  initialHandlers: Record<string, TaskHandler> = {},
): TaskRegistry {
  const handlers = new Map(Object.entries(initialHandlers));
  return {
    get(taskType) {
      return handlers.get(taskType);
    },
    register(taskType, handler) {
      handlers.set(taskType, handler);
    },
    entries() {
      return handlers.entries();
    },
  };
}
