import type { Span } from "@opentelemetry/api";
import type { LogAttrs, LogLevel, LogScope, LogSubject } from "../logging/event.ts";
import {
  createExecutionLogger,
  type ExecutionEntryLogger,
  type ExecutionLogger,
  type StartEntryInput,
} from "../logging/execution.ts";
import type { LogLayerLike } from "../logging/loglayer.ts";
import type { MetricAttrs } from "../metrics/index.ts";
import { createCounter, createHistogram, getMeter, recordDuration } from "../metrics/index.ts";
import type { TraceAttrs, TracerOptions } from "../tracing/index.ts";
import { traceStep } from "../tracing/index.ts";

export type ObserveLog = {
  debug(message: string, attrs?: LogAttrs): void;
  info(message: string, attrs?: LogAttrs): void;
  warn(message: string, attrs?: LogAttrs): void;
  error(error: unknown, message?: string, attrs?: LogAttrs): void;
  event(level: LogLevel, message: string, attrs?: LogAttrs): void;
};

export type ObserveMetric = {
  count(name: string, value?: number, attrs?: MetricAttrs): void;
  duration<T>(name: string, fn: () => Promise<T> | T, attrs?: MetricAttrs): Promise<T>;
  histogram(name: string, value: number, attrs?: MetricAttrs): void;
};

export type ObserveStepOptions = {
  attrs?: LogAttrs & TraceAttrs;
  metricName?: string;
};

export type ObserveContext = {
  readonly executionId?: string;
  readonly entryId?: string;
  readonly scope: LogScope;
  readonly subject?: LogSubject;
  readonly log: ObserveLog;
  readonly metric: ObserveMetric;
  step<T>(name: string, fn: (context: ObserveContext) => Promise<T> | T): Promise<T>;
  flush(): Promise<void>;
};

export type CreateObserveContextInput = {
  scope: LogScope;
  logger: LogLayerLike;
  tracer?: TracerOptions | string;
  meter?: TracerOptions | string;
  subject?: LogSubject;
  executionId?: string;
  entry?: StartEntryInput;
  attrs?: LogAttrs;
  flush?: () => Promise<void> | void;
  now?: () => Date;
};

export type RunObservedEntryInput = Omit<CreateObserveContextInput, "executionId" | "entry"> & {
  executionId: string;
  entry: StartEntryInput;
};

export function createObserveContext(input: CreateObserveContextInput): ObserveContext {
  const execution = input.executionId
    ? createExecutionLogger({
        executionId: input.executionId,
        scope: input.scope,
        logger: input.logger,
        subject: input.subject,
        now: input.now,
      })
    : undefined;
  const entryLogger = execution && input.entry ? execution.entry(input.entry) : undefined;
  return createObserveContextFromState({ ...input, execution, entryLogger });
}

export async function runObservedEntry<T>(
  input: RunObservedEntryInput,
  fn: (context: ObserveContext) => Promise<T> | T,
): Promise<T> {
  const execution = createExecutionLogger({
    executionId: input.executionId,
    scope: input.scope,
    logger: input.logger,
    subject: input.subject,
    now: input.now,
  });
  const entryLogger = execution.entry(input.entry);
  const context = createObserveContextFromState({ ...input, execution, entryLogger });

  try {
    const result = await fn(context);
    entryLogger.done();
    execution.complete();
    return result;
  } catch (error) {
    entryLogger.fail(error);
    execution.fail(error);
    throw error;
  } finally {
    await context.flush();
  }
}

type ObserveContextState = CreateObserveContextInput & {
  execution?: ExecutionLogger;
  entryLogger?: ExecutionEntryLogger;
};

function createObserveContextFromState(state: ObserveContextState): ObserveContext {
  const source = state.tracer ?? state.scope.service;
  const meter = state.meter ?? state.scope.service;
  const attrs = state.attrs ?? {};
  const log = createObserveLog(state.logger, state.execution, state.entryLogger, attrs);
  const metric = createObserveMetric(meter, toMetricAttrs(attrs));

  const context: ObserveContext = {
    executionId: state.execution?.executionId,
    entryId: state.entryLogger?.entryId,
    scope: state.scope,
    subject: state.subject,
    log,
    metric,
    async step(name, fn) {
      const run = () =>
        metric.duration(`${name}.duration`, () =>
          traceStep(source, name, async (span) => {
            span.setAttributes(attrs as TraceAttrs);
            return runWithEntryStep(state, name, span, fn, context, attrs);
          }),
        );
      return run();
    },
    async flush() {
      await state.flush?.();
    },
  };

  return context;
}

function createObserveLog(
  logger: LogLayerLike,
  execution: ExecutionLogger | undefined,
  entry: ExecutionEntryLogger | undefined,
  baseAttrs: LogAttrs,
): ObserveLog {
  const target = entry ?? execution;
  return {
    debug(message, attrs) {
      const metadata = mergeAttrs(baseAttrs, attrs);
      if (target) return target.debug(message, metadata);
      logger.withMetadata(metadata).debug(message);
    },
    info(message, attrs) {
      const metadata = mergeAttrs(baseAttrs, attrs);
      if (target) return target.info(message, metadata);
      logger.withMetadata(metadata).info(message);
    },
    warn(message, attrs) {
      const metadata = mergeAttrs(baseAttrs, attrs);
      if (target) return target.warn(message, metadata);
      logger.withMetadata(metadata).warn(message);
    },
    error(error, message, attrs) {
      const metadata = mergeAttrs(baseAttrs, attrs);
      if (target) return target.error(error, message, metadata);
      const value = error instanceof Error ? error : new Error(String(error));
      logger
        .withError(value)
        .withMetadata(metadata)
        .error(message ?? value.message);
    },
    event(level, message, attrs) {
      if (level === "debug") return this.debug(message, attrs);
      if (level === "info") return this.info(message, attrs);
      if (level === "warn") return this.warn(message, attrs);
      return this.error(new Error(message), message, attrs);
    },
  };
}

function createObserveMetric(
  source: TracerOptions | string,
  baseAttrs: MetricAttrs,
): ObserveMetric {
  const counters = new Map<string, ReturnType<ReturnType<typeof getMeter>["createCounter"]>>();
  const histograms = new Map<string, ReturnType<ReturnType<typeof getMeter>["createHistogram"]>>();

  return {
    count(name, value = 1, attrs) {
      let counter = counters.get(name);
      if (!counter) {
        counter = createCounter(source, name);
        counters.set(name, counter);
      }
      counter.add(value, mergeAttrs(baseAttrs, attrs));
    },
    duration(name, fn, attrs) {
      let histogram = histograms.get(name);
      if (!histogram) {
        histogram = createHistogram(source, name, { unit: "ms" });
        histograms.set(name, histogram);
      }
      return recordDuration(histogram, mergeAttrs(baseAttrs, attrs), fn);
    },
    histogram(name, value, attrs) {
      let histogram = histograms.get(name);
      if (!histogram) {
        histogram = createHistogram(source, name);
        histograms.set(name, histogram);
      }
      histogram.record(value, mergeAttrs(baseAttrs, attrs));
    },
  };
}

function runWithEntryStep<T>(
  state: ObserveContextState,
  name: string,
  span: Span,
  fn: (context: ObserveContext) => Promise<T> | T,
  context: ObserveContext,
  baseAttrs: LogAttrs,
): Promise<T> {
  if (!state.entryLogger) return Promise.resolve(fn(context));
  return state.entryLogger.step(name, async (stepLog) => {
    const stepContext: ObserveContext = {
      ...context,
      log: {
        ...context.log,
        debug: (message, attrs) => stepLog.debug(message, mergeAttrs(baseAttrs, attrs)),
        info: (message, attrs) => stepLog.info(message, mergeAttrs(baseAttrs, attrs)),
        warn: (message, attrs) => stepLog.warn(message, mergeAttrs(baseAttrs, attrs)),
        error: (error, message, attrs) =>
          stepLog.error(error, message, mergeAttrs(baseAttrs, attrs)),
        event: (level, message, attrs) =>
          stepLog.event(level, message, mergeAttrs(baseAttrs, attrs)),
      },
    };
    span.setAttribute("execution.step", name);
    return fn(stepContext);
  });
}

function mergeAttrs<T extends Record<string, unknown>>(baseAttrs: T, attrs?: T): T {
  if (!attrs) return baseAttrs;
  return { ...baseAttrs, ...attrs };
}

function toMetricAttrs(attrs: LogAttrs): MetricAttrs {
  const metricAttrs: MetricAttrs = {};
  for (const [key, value] of Object.entries(attrs)) {
    if (isMetricAttrValue(value)) metricAttrs[key] = value;
  }
  return metricAttrs;
}

function isMetricAttrValue(value: unknown): value is MetricAttrs[string] {
  if (typeof value === "string" || typeof value === "number" || typeof value === "boolean") {
    return true;
  }
  if (!Array.isArray(value)) return false;
  return value.every(
    (item) => typeof item === "string" || typeof item === "number" || typeof item === "boolean",
  );
}

export * from "./cron.ts";
export * from "./queue.ts";
