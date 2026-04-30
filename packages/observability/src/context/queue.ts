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
