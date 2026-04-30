import type { LogAttrs, LogScope, LogSubject } from "../logging/event.ts";
import type { StartEntryInput } from "../logging/execution.ts";
import { createExecutionLogLayer } from "../logging/loglayer.ts";
import type { CreateExecutionLogLayerOptions } from "../logging/loglayer.ts";
import { runObservedEntry, type ObserveContext } from "./index.ts";

export type CronObserveEvent = {
  cron: string;
  scheduledTime: number;
};

export type CronObserveRuntime = {
  waitUntil?(promise: Promise<unknown>): void;
};

export type CronObserveConfig<TEvent extends CronObserveEvent> = {
  transports: CreateExecutionLogLayerOptions["transports"];
  scope: LogScope | ((event: TEvent) => LogScope);
  executionId?: (event: TEvent) => string;
  subject?: (event: TEvent) => LogSubject | undefined;
  attrs?: LogAttrs | ((event: TEvent) => LogAttrs);
  entry?: (event: TEvent) => StartEntryInput;
  flush?: (event: TEvent) => Promise<void> | void;
  now?: () => Date;
};

export type CronObserver<TEvent extends CronObserveEvent> = {
  run<T>(
    event: TEvent,
    runtime: CronObserveRuntime | undefined,
    fn: (observe: ObserveContext) => Promise<T> | T,
  ): Promise<T>;
};

export function createCronObserver<TEvent extends CronObserveEvent>(
  config: CronObserveConfig<TEvent>,
): CronObserver<TEvent> {
  return {
    async run(event, runtime, fn) {
      const executionId = config.executionId?.(event) ?? defaultCronExecutionId(event);
      const flush = () => Promise.resolve(config.flush?.(event));
      try {
        return await runObservedEntry(
          {
            executionId,
            entry: config.entry?.(event) ?? defaultCronEntry(event),
            scope: resolveValue(config.scope, event),
            subject: config.subject?.(event),
            attrs: {
              cron: event.cron,
              scheduledTime: event.scheduledTime,
              ...(config.attrs ? resolveValue(config.attrs, event) : undefined),
            },
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

function defaultCronExecutionId(event: CronObserveEvent) {
  return `cron:${event.cron}:${event.scheduledTime}`;
}

function defaultCronEntry(event: CronObserveEvent): StartEntryInput {
  return {
    entryId: `${event.cron}:${event.scheduledTime}`,
    kind: "cron",
    batchId: event.cron,
  };
}

function resolveValue<TEvent, TValue>(value: TValue | ((event: TEvent) => TValue), event: TEvent) {
  if (typeof value === "function") return (value as (event: TEvent) => TValue)(event);
  return value;
}
