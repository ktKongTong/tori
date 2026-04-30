import { SpanStatusCode, trace, type Span, type SpanOptions } from "@opentelemetry/api";

export type TraceAttrs = Record<
  string,
  string | number | boolean | string[] | number[] | boolean[]
>;

export type TraceStepOptions = {
  name: string;
  attrs?: TraceAttrs;
  spanOptions?: SpanOptions;
};

export type TraceStepInput = string | TraceStepOptions;

export type TracerOptions = {
  name: string;
  version?: string;
};

export function getTracer(options: TracerOptions | string) {
  if (typeof options === "string") return trace.getTracer(options);
  return trace.getTracer(options.name, options.version);
}

export function getActiveSpan() {
  return trace.getActiveSpan();
}

export function setSpanAttrs(span: Span, attrs?: TraceAttrs) {
  if (attrs) span.setAttributes(attrs);
}

export async function traceStep<T>(
  source: TracerOptions | string,
  input: TraceStepInput,
  fn: (span: Span) => Promise<T> | T,
): Promise<T> {
  const tracer = getTracer(source);
  const options = normalizeTraceStepInput(input);
  return tracer.startActiveSpan(options.name, options.spanOptions ?? {}, async (span) => {
    try {
      setSpanAttrs(span, options.attrs);
      const result = await fn(span);
      span.setStatus({ code: SpanStatusCode.OK });
      return result;
    } catch (error) {
      recordSpanError(span, error);
      throw error;
    } finally {
      span.end();
    }
  });
}

export function recordSpanError(span: Span, error: unknown) {
  if (error instanceof Error) {
    span.recordException(error);
    span.setStatus({ code: SpanStatusCode.ERROR, message: error.message });
    return;
  }
  const message = String(error);
  span.recordException({ message });
  span.setStatus({ code: SpanStatusCode.ERROR, message });
}

function normalizeTraceStepInput(input: TraceStepInput): TraceStepOptions {
  if (typeof input === "string") return { name: input };
  return input;
}
