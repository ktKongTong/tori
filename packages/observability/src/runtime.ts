import type { LogAttrs, LogScope, LogSubject } from "./logging/event.ts";
import {
  createExecutionLogLayer,
  type CreateExecutionLogLayerOptions,
  type LogLayerLike,
} from "./logging/loglayer.ts";
import {
  createObserveContext,
  runObservedEntry,
  type CreateObserveContextInput,
  type ObserveContext,
  type RunObservedEntryInput,
} from "./context/index.ts";
import {
  createCronObserver,
  type CronObserveConfig,
  type CronObserveEvent,
  type CronObserver,
} from "./context/cron.ts";
import {
  createQueueObserver,
  createTaskQueueObserver,
  type QueueObserveConfig,
  type QueueObserveMessage,
  type QueueObserver,
  type TaskQueueMessage,
  type TaskQueueObserveConfig,
} from "./context/queue.ts";

export type ObserveRuntimeOptions = {
  scope: LogScope;
  transports: CreateExecutionLogLayerOptions["transports"];
  logger?: LogLayerLike;
  subject?: LogSubject;
  attrs?: LogAttrs;
  now?: () => Date;
  flush?: () => Promise<void> | void;
};

export type ObserveRuntime = {
  readonly scope: LogScope;
  readonly logger: LogLayerLike;
  context(input?: Partial<CreateObserveContextInput>): ObserveContext;
  runEntry<T>(
    input: Pick<RunObservedEntryInput, "executionId" | "entry"> & Partial<RunObservedEntryInput>,
    fn: (context: ObserveContext) => Promise<T> | T,
  ): Promise<T>;
  queue<TMessage extends QueueObserveMessage>(
    config: Omit<QueueObserveConfig<TMessage>, "transports" | "scope"> &
      Partial<Pick<QueueObserveConfig<TMessage>, "scope">>,
  ): QueueObserver<TMessage>;
  taskQueue<TMessage extends TaskQueueMessage>(
    config?: Omit<TaskQueueObserveConfig<TMessage>, "transports" | "scope"> &
      Partial<Pick<TaskQueueObserveConfig<TMessage>, "scope">>,
  ): QueueObserver<TMessage>;
  cron<TEvent extends CronObserveEvent>(
    config?: Omit<CronObserveConfig<TEvent>, "transports" | "scope"> &
      Partial<Pick<CronObserveConfig<TEvent>, "scope">>,
  ): CronObserver<TEvent>;
};

export function createObserveRuntime(options: ObserveRuntimeOptions): ObserveRuntime {
  const logger = options.logger ?? createExecutionLogLayer({ transports: options.transports });
  const base = {
    scope: options.scope,
    logger,
    subject: options.subject,
    attrs: options.attrs,
    flush: options.flush,
    now: options.now,
  };

  return {
    scope: options.scope,
    logger,
    context(input = {}) {
      return createObserveContext({ ...base, ...input });
    },
    runEntry(input, fn) {
      return runObservedEntry({ ...base, ...input }, fn);
    },
    queue(config) {
      return createQueueObserver({
        ...config,
        transports: options.transports,
        scope: config.scope ?? options.scope,
        flush: config.flush ?? options.flush,
        now: config.now ?? options.now,
      });
    },
    taskQueue(config = {}) {
      return createTaskQueueObserver({
        ...config,
        transports: options.transports,
        scope: config.scope ?? options.scope,
        flush: config.flush ?? options.flush,
        now: config.now ?? options.now,
      });
    },
    cron(config = {}) {
      return createCronObserver({
        ...config,
        transports: options.transports,
        scope: config.scope ?? options.scope,
        flush: config.flush ?? options.flush,
        now: config.now ?? options.now,
      });
    },
  };
}
