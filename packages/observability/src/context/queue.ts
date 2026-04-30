import { taskEntryId, type TypedTaskEnvelope } from "@repo/task";
import type { LogAttrs, LogScope, LogSubject } from "../logging/event.ts";
import type { StartEntryInput } from "../logging/execution.ts";
import { createExecutionLogLayer } from "../logging/loglayer.ts";
import type { CreateExecutionLogLayerOptions } from "../logging/loglayer.ts";
import { runObservedEntry, type ObserveContext } from "./index.ts";

export type QueueObserveMessage = {
  id: string;
  attempts?: number;
};

export type QueueObserveRuntime = {
  waitUntil?(promise: Promise<unknown>): void;
};

export type QueueObserveConfig<TMessage extends QueueObserveMessage> = {
  transports: CreateExecutionLogLayerOptions["transports"];
  scope: LogScope | ((message: TMessage) => LogScope);
  executionId: (message: TMessage) => string;
  subject?: (message: TMessage) => LogSubject | undefined;
  attrs?: LogAttrs | ((message: TMessage) => LogAttrs);
  entry?: (message: TMessage) => StartEntryInput;
  flush?: (message: TMessage) => Promise<void> | void;
  now?: () => Date;
};

export type QueueObserver<TMessage extends QueueObserveMessage> = {
  run<T>(
    message: TMessage,
    runtime: QueueObserveRuntime | undefined,
    fn: (observe: ObserveContext) => Promise<T> | T,
  ): Promise<T>;
};

export type TaskQueueMessage<TPayload = unknown> = QueueObserveMessage & {
  task: TypedTaskEnvelope<TPayload>;
};

export type TaskQueueObserveConfig<TMessage extends TaskQueueMessage> = Omit<
  QueueObserveConfig<TMessage>,
  "executionId" | "entry" | "attrs"
> & {
  attrs?: LogAttrs | ((message: TMessage) => LogAttrs);
  entryKind?: string;
};

export function createQueueObserver<TMessage extends QueueObserveMessage>(
  config: QueueObserveConfig<TMessage>,
): QueueObserver<TMessage> {
  return {
    async run(message, runtime, fn) {
      const flush = () => Promise.resolve(config.flush?.(message));
      try {
        return await runObservedEntry(
          {
            executionId: config.executionId(message),
            entry: config.entry?.(message) ?? defaultQueueEntry(message),
            scope: resolveValue(config.scope, message),
            subject: config.subject?.(message),
            attrs: config.attrs ? resolveValue(config.attrs, message) : undefined,
            logger: createExecutionLogLayer({ transports: config.transports }),
            flush,
            now: config.now,
          },
          fn,
        );
      } finally {
        runtime?.waitUntil?.(flush());
      }
    },
  };
}

export function createTaskQueueObserver<TMessage extends TaskQueueMessage>(
  config: TaskQueueObserveConfig<TMessage>,
): QueueObserver<TMessage> {
  return createQueueObserver({
    ...config,
    executionId: (message) => message.task.taskId,
    entry: (message) => ({
      entryId: taskEntryId(message.task),
      kind: config.entryKind ?? "queue",
      attempt: message.attempts,
      partition: message.task.partition?.key,
      batchId: message.task.taskType,
      messageId: message.id,
    }),
    attrs: (message) => ({
      taskId: message.task.taskId,
      taskType: message.task.taskType,
      taskPartition: message.task.partition?.key,
      taskTraceId: message.task.traceId,
      ...(typeof config.attrs === "function" ? config.attrs(message) : config.attrs),
    }),
  });
}

function defaultQueueEntry(message: QueueObserveMessage): StartEntryInput {
  return {
    entryId: message.id,
    kind: "queue",
    attempt: message.attempts,
    messageId: message.id,
  };
}

function resolveValue<TMessage, TValue>(
  value: TValue | ((message: TMessage) => TValue),
  message: TMessage,
) {
  if (typeof value === "function") return (value as (message: TMessage) => TValue)(message);
  return value;
}
