import { AsyncLocalStorage } from "node:async_hooks";
import {
  type Attributes,
  context as otelContext,
  propagation,
  SpanStatusCode,
  trace,
} from "@opentelemetry/api";
import { createSpanId, formatTraceparent } from "@repo/core/utils/trace";

export type ObservationJournalEntry = {
  level: "info" | "warn" | "error" | "debug";
  msg: string;
  attrs: Record<string, unknown> | null;
  meta: Record<string, unknown> | null;
  traceId: string;
  spanId: string;
  correlationId: string;
  source: string;
  createdAt: Date;
};

export type ObservationJournalSink = {
  write(entry: ObservationJournalEntry): void;
  close?(): Promise<void>;
};

export type TraceStepOptions = {
  name: string;
  attrs?: Attributes;
  attributePrefix?: string;
};

export type ObservationScope = {
  traceId: string;
  spanId: string;
  traceparent: string | null;
  tracestate: string | null;
  correlationId: string;
  journalSink?: ObservationJournalSink | null;
  journalAttrs?: Record<string, unknown> | null;
};

export type ObservationSource = Pick<
  ObservationScope,
  "traceId" | "spanId" | "traceparent" | "tracestate" | "correlationId"
>;

const storage = new AsyncLocalStorage<ObservationScope>();
const tracer = trace.getTracer("tori/observation");

export function getObservationScope(): ObservationScope | null {
  return storage.getStore() ?? null;
}

export function createObservationScopeFromServiceContext(ctx: ObservationSource): ObservationScope {
  return {
    traceId: ctx.traceId,
    spanId: ctx.spanId,
    traceparent: ctx.traceparent,
    tracestate: ctx.tracestate,
    correlationId: ctx.correlationId,
    journalSink: null,
    journalAttrs: null,
  };
}

export function runWithObservationScope<T>(scope: ObservationScope, fn: () => T): T {
  return storage.run(scope, fn);
}

export function attachJournalSink(
  scope: ObservationScope,
  journalSink: ObservationJournalSink,
  journalAttrs?: Record<string, unknown> | null,
): ObservationScope {
  const mergedJournalAttrs =
    journalAttrs == null
      ? (scope.journalAttrs ?? null)
      : { ...scope.journalAttrs, ...journalAttrs };

  return {
    ...scope,
    journalSink,
    journalAttrs: mergedJournalAttrs,
  };
}

export function createChildObservationScope(
  source: ObservationScope | ObservationSource,
  options?: { tracestate?: string | null },
): ObservationScope {
  const parent = resolveObservationParent(source);
  const spanId = createSpanId();
  return {
    traceId: parent.traceId,
    spanId,
    traceparent: formatTraceparent(parent.traceId, spanId),
    tracestate: options?.tracestate ?? parent.tracestate,
    correlationId: parent.correlationId,
    journalSink: parent.journalSink ?? null,
    journalAttrs: parent.journalAttrs ?? null,
  };
}

export async function traceStep<T>(
  source: ObservationScope | ObservationSource,
  options: TraceStepOptions,
  fn: () => Promise<T>,
): Promise<T> {
  const parentScope = resolveObservationParent(source);
  const childScope = createChildObservationScope(source);
  const parentContext = toParentOtelContext(parentScope);

  return await runWithObservationScope(
    childScope,
    async () =>
      await tracer.startActiveSpan(
        options.name,
        {
          attributes: buildObservationAttrs(
            childScope,
            options.attrs,
            options.attributePrefix ?? "tori",
          ),
        },
        parentContext,
        async (span) => {
          try {
            const result = await fn();
            span.setStatus({ code: SpanStatusCode.OK });
            return result;
          } catch (error) {
            if (error instanceof Error) {
              span.recordException(error);
              span.setStatus({ code: SpanStatusCode.ERROR, message: error.message });
            } else {
              span.setStatus({ code: SpanStatusCode.ERROR, message: String(error) });
            }
            throw error;
          } finally {
            span.end();
          }
        },
      ),
  );
}

function resolveObservationParent(source: ObservationScope | ObservationSource): ObservationScope {
  if ("journalSink" in source) {
    return source;
  }
  return getObservationScope() ?? createObservationScopeFromServiceContext(source);
}

function toParentOtelContext(scope: ObservationScope) {
  const carrier: Record<string, string> = {};
  if (scope.traceparent) {
    carrier.traceparent = scope.traceparent;
  }
  if (scope.tracestate) {
    carrier.tracestate = scope.tracestate;
  }
  return Object.keys(carrier).length > 0
    ? propagation.extract(otelContext.active(), carrier)
    : otelContext.active();
}

function buildObservationAttrs(
  scope: ObservationScope,
  attrs?: Attributes,
  attributePrefix = "tori",
): Attributes {
  return {
    [`${attributePrefix}.trace_id`]: scope.traceId,
    [`${attributePrefix}.span_id`]: scope.spanId,
    [`${attributePrefix}.correlation_id`]: scope.correlationId,
    ...attrs,
  };
}
