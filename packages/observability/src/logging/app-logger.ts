import type { LogFn } from "pino";
import { pino } from "pino";

import { getObservationScope } from "../scope.ts";

export interface AppLogger {
  info(msg: string, details?: Record<string, unknown> | LogDetails): void;
  warn(msg: string, details?: Record<string, unknown> | LogDetails): void;
  error(msg: string, details?: Record<string, unknown> | LogDetails): void;
  debug(msg: string, details?: Record<string, unknown> | LogDetails): void;
}

export type LogDetails = {
  attrs?: Record<string, unknown> | null;
  meta?: Record<string, unknown> | null;
};

export type LogExportTransform = (
  fields: Record<string, unknown>,
  context: LoggerContext,
) => Record<string, unknown>;

export type LoggerContext = {
  traceId: string;
  spanId: string;
  correlationId: string;
  source: string;
};

export type LoggerFactory = (context: LoggerContext) => AppLogger;

export const createNoopLoggerFactory: LoggerFactory = () => ({
  info() {},
  warn() {},
  error() {},
  debug() {},
});

export const pinoLogger = pino({
  browser: {
    formatters: {
      level(label, _number) {
        return { level: label.toUpperCase() };
      },
    },
    asObject: false,
    write: (output) => console.log(output),
  },
  hooks: {
    logMethod(this: unknown, args: Parameters<LogFn>, _method: LogFn, level: number) {
      const consoleFn =
        level >= 50
          ? console.error
          : level >= 40
            ? console.warn
            : level >= 20
              ? console.log
              : console.debug;

      consoleFn(...args);
    },
  },
  enabled: true,
  level: "info",
  timestamp: pino.stdTimeFunctions.isoTime,
});

const identityLogExportTransform: LogExportTransform = (fields) => fields;
let currentLogExportTransform: LogExportTransform = identityLogExportTransform;

export function configureLogExportTransform(transform?: LogExportTransform) {
  currentLogExportTransform = transform ?? identityLogExportTransform;
}

export function resetLogExportTransform() {
  currentLogExportTransform = identityLogExportTransform;
}

class PinoAppLogger implements AppLogger {
  constructor(private context: LoggerContext) {}

  private write(
    level: "info" | "warn" | "error" | "debug",
    msg: string,
    payload?: Record<string, unknown> | LogDetails,
  ): void {
    const scope = getObservationScope();
    const traceId = scope?.traceId ?? this.context.traceId;
    const spanId = scope?.spanId ?? this.context.spanId;
    const correlationId = scope?.correlationId ?? this.context.correlationId;
    const source = this.context.source;
    const createdAt = new Date();
    const { attrs, meta, exportFields } = normalizeLogPayload(payload, scope?.journalAttrs ?? null);
    const fields = currentLogExportTransform(
      {
        ...exportFields,
        correlationId,
        traceId,
        spanId,
        source,
      },
      { traceId, spanId, correlationId, source },
    );

    pinoLogger[level](fields, msg);

    scope?.journalSink?.write({
      level,
      msg,
      attrs,
      meta,
      traceId,
      spanId,
      correlationId,
      source,
      createdAt,
    });
  }

  info(msg: string, payload?: Record<string, unknown> | LogDetails): void {
    this.write("info", msg, payload);
  }

  warn(msg: string, payload?: Record<string, unknown> | LogDetails): void {
    this.write("warn", msg, payload);
  }

  error(msg: string, payload?: Record<string, unknown> | LogDetails): void {
    this.write("error", msg, payload);
  }

  debug(msg: string, payload?: Record<string, unknown> | LogDetails): void {
    this.write("debug", msg, payload);
  }
}

export function createPinoAppLogger(context: LoggerContext): AppLogger {
  return new PinoAppLogger(context);
}

function normalizeLogPayload(
  payload: Record<string, unknown> | LogDetails | undefined,
  inheritedAttrs: Record<string, unknown> | null,
): {
  attrs: Record<string, unknown> | null;
  meta: Record<string, unknown> | null;
  exportFields: Record<string, unknown>;
} {
  const structured = isLogDetails(payload);
  const attrs = mergeAttrs(inheritedAttrs, structured ? (payload.attrs ?? null) : null);
  const meta = structured ? (payload.meta ?? null) : (payload ?? null);

  if (structured) {
    return {
      attrs,
      meta,
      exportFields: {
        ...(attrs ? { attrs } : {}),
        ...(meta ? { meta } : {}),
      },
    };
  }

  return {
    attrs,
    meta,
    exportFields: {
      ...meta,
      ...(attrs ? { attrs } : {}),
    },
  };
}

function isLogDetails(
  payload: Record<string, unknown> | LogDetails | undefined,
): payload is LogDetails {
  if (!payload || Array.isArray(payload)) {
    return false;
  }
  return "attrs" in payload || "meta" in payload;
}

function mergeAttrs(
  base: Record<string, unknown> | null,
  extra: Record<string, unknown> | null,
): Record<string, unknown> | null {
  if (!base && !extra) {
    return null;
  }
  return {
    ...base,
    ...extra,
  };
}
