import type {
  ExecutionEntryInfo,
  ExecutionLogEvent,
  ExecutionEventKind,
  LogAttrs,
  LogLevel,
  LogScope,
  LogSubject,
  TraceContext,
} from "./event.ts";
import { serializeError } from "./event.ts";
import { emitExecutionEvent, type LogLayerLike } from "./loglayer.ts";

export type CreateExecutionLoggerInput = {
  executionId: string;
  scope: LogScope;
  logger: LogLayerLike;
  subject?: LogSubject;
  trace?: TraceContext;
  now?: () => Date;
};

export type StartEntryInput = ExecutionEntryInfo & {
  entryId: string;
};

export type StepLogger = {
  debug(message: string, attrs?: LogAttrs): void;
  info(message: string, attrs?: LogAttrs): void;
  warn(message: string, attrs?: LogAttrs): void;
  error(error: unknown, message?: string, attrs?: LogAttrs): void;
  event(level: LogLevel, message: string, attrs?: LogAttrs): void;
};

export type ExecutionEntryLogger = {
  readonly entryId: string;
  step(name: string): StepLogger;
  step<T>(name: string, fn: (log: StepLogger) => Promise<T> | T): Promise<T>;
  debug(message: string, attrs?: LogAttrs): void;
  info(message: string, attrs?: LogAttrs): void;
  warn(message: string, attrs?: LogAttrs): void;
  error(error: unknown, message?: string, attrs?: LogAttrs): void;
  done(attrs?: LogAttrs): void;
  fail(error: unknown, attrs?: LogAttrs): void;
};

export type ExecutionLogger = {
  readonly executionId: string;
  entry(input: StartEntryInput): ExecutionEntryLogger;
  runEntry<T>(
    input: StartEntryInput,
    fn: (entry: ExecutionEntryLogger) => Promise<T> | T,
  ): Promise<T>;
  debug(message: string, attrs?: LogAttrs): void;
  info(message: string, attrs?: LogAttrs): void;
  warn(message: string, attrs?: LogAttrs): void;
  error(error: unknown, message?: string, attrs?: LogAttrs): void;
  complete(attrs?: LogAttrs): void;
  fail(error: unknown, attrs?: LogAttrs): void;
};

export function createExecutionLogger(input: CreateExecutionLoggerInput): ExecutionLogger {
  const now = input.now ?? (() => new Date());
  const base = new EventEmitterState(input, now);
  base.emit("execution.started", "info", "execution started");

  return {
    executionId: input.executionId,
    entry(entryInput) {
      return createEntryLogger(base, entryInput);
    },
    async runEntry(entryInput, fn) {
      const entry = createEntryLogger(base, entryInput);
      try {
        const result = await fn(entry);
        entry.done();
        return result;
      } catch (error) {
        entry.fail(error);
        throw error;
      }
    },
    debug: (message, attrs) => base.emit("log", "debug", message, attrs),
    info: (message, attrs) => base.emit("log", "info", message, attrs),
    warn: (message, attrs) => base.emit("log", "warn", message, attrs),
    error: (error, message, attrs) => base.emitError("log", error, message, attrs),
    complete: (attrs) => base.emit("execution.completed", "info", "execution completed", attrs),
    fail: (error, attrs) => base.emitError("execution.failed", error, "execution failed", attrs),
  };
}

function createEntryLogger(base: EventEmitterState, input: StartEntryInput): ExecutionEntryLogger {
  const entry = new EntryEmitterState(base, input);
  entry.emit("entry.started", "info", "entry started");

  const createStep = (name: string) => createStepLogger(entry, name);

  function step<T>(
    name: string,
    fn?: (log: StepLogger) => Promise<T> | T,
  ): StepLogger | Promise<T> {
    const logger = createStep(name);
    if (!fn) return logger;
    return runStep(entry, name, logger, fn);
  }

  return {
    entryId: input.entryId,
    step: step as ExecutionEntryLogger["step"],
    debug: (message, attrs) => entry.emit("log", "debug", message, attrs),
    info: (message, attrs) => entry.emit("log", "info", message, attrs),
    warn: (message, attrs) => entry.emit("log", "warn", message, attrs),
    error: (error, message, attrs) => entry.emitError("log", error, message, attrs),
    done: (attrs) => entry.emit("entry.completed", "info", "entry completed", attrs),
    fail: (error, attrs) => entry.emitError("entry.failed", error, "entry failed", attrs),
  };
}

async function runStep<T>(
  entry: EntryEmitterState,
  name: string,
  logger: StepLogger,
  fn: (log: StepLogger) => Promise<T> | T,
): Promise<T> {
  entry.emit("step.started", "info", "step started", undefined, name);
  const startedAt = entry.now().getTime();
  try {
    const result = await fn(logger);
    entry.emit(
      "step.completed",
      "info",
      "step completed",
      { elapsedMs: entry.now().getTime() - startedAt },
      name,
    );
    return result;
  } catch (error) {
    entry.emitError(
      "step.failed",
      error,
      "step failed",
      { elapsedMs: entry.now().getTime() - startedAt },
      name,
    );
    throw error;
  }
}

function createStepLogger(entry: EntryEmitterState, stepId: string): StepLogger {
  return {
    debug: (message, attrs) => entry.emit("log", "debug", message, attrs, stepId),
    info: (message, attrs) => entry.emit("log", "info", message, attrs, stepId),
    warn: (message, attrs) => entry.emit("log", "warn", message, attrs, stepId),
    error: (error, message, attrs) => entry.emitError("log", error, message, attrs, stepId),
    event: (level, message, attrs) => entry.emit("log", level, message, attrs, stepId),
  };
}

class EventEmitterState {
  private sequence = 0;
  readonly now: () => Date;

  constructor(
    private readonly input: CreateExecutionLoggerInput,
    now: () => Date,
  ) {
    this.now = now;
  }

  emit(kind: ExecutionEventKind, level: LogLevel, message: string, attrs?: LogAttrs) {
    this.emitEvent(this.createEvent(kind, level, message, attrs));
  }

  emitError(kind: ExecutionEventKind, error: unknown, message = "error", attrs?: LogAttrs) {
    this.emitEvent(
      this.createEvent(
        kind,
        "error",
        message,
        attrs,
        undefined,
        undefined,
        undefined,
        serializeError(error),
      ),
    );
  }

  emitEvent(event: ExecutionLogEvent) {
    emitExecutionEvent(this.input.logger, event);
  }

  createEvent(
    kind: ExecutionEventKind,
    level: LogLevel,
    message: string,
    attrs?: LogAttrs,
    entryId?: string,
    entry?: ExecutionEntryInfo,
    stepId?: string,
    error?: ReturnType<typeof serializeError>,
    entrySequence?: number,
  ): ExecutionLogEvent {
    const timestamp = this.now().toISOString();
    this.sequence += 1;
    return {
      kind,
      timestamp,
      level,
      message,
      attrs,
      scope: this.input.scope,
      subject: this.input.subject,
      executionId: this.input.executionId,
      entryId,
      entry,
      stepId,
      trace: this.input.trace,
      error,
      entrySequence,
      sequence: `${timestamp}-${this.input.executionId}-${String(this.sequence).padStart(8, "0")}`,
    };
  }
}

class EntryEmitterState {
  private sequence = 0;

  constructor(
    private readonly base: EventEmitterState,
    private readonly input: StartEntryInput,
  ) {}

  now() {
    return this.base.now();
  }

  emit(
    kind: ExecutionEventKind,
    level: LogLevel,
    message: string,
    attrs?: LogAttrs,
    stepId?: string,
  ) {
    this.sequence += 1;
    this.base.emitEvent(
      this.base.createEvent(
        kind,
        level,
        message,
        attrs,
        this.input.entryId,
        this.input,
        stepId,
        undefined,
        this.sequence,
      ),
    );
  }

  emitError(
    kind: ExecutionEventKind,
    error: unknown,
    message = "error",
    attrs?: LogAttrs,
    stepId?: string,
  ) {
    this.sequence += 1;
    this.base.emitEvent(
      this.base.createEvent(
        kind,
        "error",
        message,
        attrs,
        this.input.entryId,
        this.input,
        stepId,
        serializeError(error),
        this.sequence,
      ),
    );
  }
}
