import { LogLayer } from "loglayer";
import { PinoTransport } from "@loglayer/transport-pino";
import { pino, type LoggerOptions } from "pino";
import type { ExecutionLogEvent, LogAttrs } from "./event.ts";
import { logErrorToError } from "./event.ts";

export type LogLayerLike = {
  withMetadata(metadata: LogAttrs): LogLayerLike;
  withError(error: Error): LogLayerLike;
  debug(message: string): void;
  info(message: string): void;
  warn(message: string): void;
  error(message: string): void;
};

export type CreateExecutionLogLayerOptions = {
  transports: ConstructorParameters<typeof LogLayer>[0]["transport"];
};

export function createExecutionLogLayer(options: CreateExecutionLogLayerOptions): LogLayerLike {
  return new LogLayer({ transport: options.transports }) as unknown as LogLayerLike;
}

export type CreatePinoTransportOptions = {
  pino?: ReturnType<typeof pino>;
  pinoOptions?: LoggerOptions;
};

export function createPinoTransport(options: CreatePinoTransportOptions = {}) {
  return new PinoTransport({
    logger: (options.pino ??
      pino({ level: "trace", ...options.pinoOptions })) as ConstructorParameters<
      typeof PinoTransport
    >[0]["logger"],
  });
}

export function emitExecutionEvent(logger: LogLayerLike, event: ExecutionLogEvent) {
  const metadata = eventMetadata(event);
  const target = event.error
    ? logger.withError(logErrorToError(event.error)).withMetadata(metadata)
    : logger.withMetadata(metadata);
  if (event.level === "debug") return target.debug(event.message);
  if (event.level === "info") return target.info(event.message);
  if (event.level === "warn") return target.warn(event.message);
  return target.error(event.message);
}

export function eventMetadata(event: ExecutionLogEvent): LogAttrs {
  return {
    ...event.attrs,
    event,
    kind: event.kind,
    timestamp: event.timestamp,
    scope: event.scope,
    subject: event.subject,
    executionId: event.executionId,
    entryId: event.entryId,
    stepId: event.stepId,
    sequence: event.sequence,
    entrySequence: event.entrySequence,
    entry: event.entry,
    elapsedMs: event.elapsedMs,
    trace: event.trace,
  };
}
