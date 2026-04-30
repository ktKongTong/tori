export type LogLevel = "debug" | "info" | "warn" | "error";

export type LogAttrs = Record<string, unknown>;

export type LogSubject = {
  type: string;
  id: string;
};

export type LogScope = {
  service: string;
  module?: string;
  operation?: string;
};

export type ExecutionEntryKind = string;

export type ExecutionEntryInfo = {
  kind: ExecutionEntryKind;
  attempt?: number;
  partition?: string;
  batchId?: string;
  messageId?: string;
};

export type ExecutionEventKind =
  | "execution.started"
  | "execution.updated"
  | "execution.completed"
  | "execution.failed"
  | "entry.started"
  | "entry.completed"
  | "entry.failed"
  | "step.started"
  | "step.completed"
  | "step.failed"
  | "log";

export type LogError = {
  name?: string;
  message: string;
  stack?: string;
  code?: string;
};

export type TraceContext = {
  traceId?: string;
  spanId?: string;
};

export type ExecutionLogEvent = {
  kind: ExecutionEventKind;
  timestamp: string;
  level: LogLevel;
  message: string;
  attrs?: LogAttrs;
  scope: LogScope;
  subject?: LogSubject;
  executionId: string;
  entryId?: string;
  stepId?: string;
  sequence: string;
  entrySequence?: number;
  entry?: ExecutionEntryInfo;
  elapsedMs?: number;
  trace?: TraceContext;
  error?: LogError;
};

export type LogQuery = {
  executionId?: string;
  entryId?: string;
  level?: LogLevel;
  cursor?: string;
  limit?: number;
};

export type LogQueryResult = {
  events: ExecutionLogEvent[];
  nextCursor?: string;
};

export type ExecutionLogChunk = {
  chunkId: string;
  executionId: string;
  entryId?: string;
  chunkSequence: number;
  eventCount: number;
  firstTimestamp: string;
  lastTimestamp: string;
  entrySequenceStart?: number;
  entrySequenceEnd?: number;
  hasError: boolean;
  events: ExecutionLogEvent[];
};

export type ExecutionLogChunkQuery = {
  executionId?: string;
  entryId?: string;
  level?: LogLevel;
  cursor?: string;
  limit?: number;
};

export type ExecutionLogChunkQueryResult = {
  chunks: ExecutionLogChunk[];
  nextCursor?: string;
};

export type ExecutionEntryManifest = {
  entryId: string;
  kind: string;
  status: "running" | "success" | "failed";
  startedAt: string;
  endedAt?: string;
  objectKey: string;
  eventCount: number;
  errorCount: number;
  firstTimestamp?: string;
  lastTimestamp?: string;
};

export type ExecutionLogManifest = {
  executionId: string;
  status: "running" | "success" | "failed" | "partial_failed" | "cancelled";
  startedAt: string;
  endedAt?: string;
  entries: ExecutionEntryManifest[];
};

export function serializeError(error: unknown): LogError {
  if (error instanceof Error) {
    const errorWithCode = error as Error & { code?: unknown };
    const code = typeof errorWithCode.code === "string" ? errorWithCode.code : undefined;
    return {
      name: error.name,
      message: error.message,
      stack: error.stack,
      code,
    };
  }
  return { message: String(error) };
}

export function logErrorToError(error: LogError): Error {
  const value = new Error(error.message);
  value.name = error.name ?? "Error";
  value.stack = error.stack;
  if (error.code) Object.assign(value, { code: error.code });
  return value;
}

export function isExecutionLogEvent(value: unknown): value is ExecutionLogEvent {
  if (typeof value !== "object" || value === null) return false;
  const record = value as Partial<ExecutionLogEvent>;
  return typeof record.executionId === "string" && typeof record.sequence === "string";
}
