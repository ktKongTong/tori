import { LoggerlessTransport, type LogLayerTransportParams } from "@loglayer/transport";
import type {
  ExecutionLogChunk,
  ExecutionLogChunkQuery,
  ExecutionLogChunkQueryResult,
  ExecutionLogEvent,
  LogQuery,
  LogQueryResult,
} from "../event.ts";
import { isExecutionLogEvent } from "../event.ts";

export type ExecutionLogStore = {
  appendChunk(chunk: ExecutionLogChunk): void | Promise<void>;
  queryChunks(input: ExecutionLogChunkQuery): Promise<ExecutionLogChunkQueryResult>;
};

export type BufferedExecutionLogStoreTransportOptions = {
  store: ExecutionLogStore;
  maxEvents?: number;
  maxBytes?: number;
  flushIntervalMs?: number;
};

export class BufferedExecutionLogStoreTransport extends LoggerlessTransport {
  private readonly maxEvents: number;
  private readonly maxBytes: number;
  private readonly flushIntervalMs?: number;
  private readonly buffers = new Map<string, ExecutionLogEvent[]>();
  private readonly chunkSequences = new Map<string, number>();
  private flushTimer: ReturnType<typeof setTimeout> | undefined;
  private pendingFlush = Promise.resolve();

  constructor(readonly options: BufferedExecutionLogStoreTransportOptions) {
    super({ id: "execution-log-store" });
    this.maxEvents = options.maxEvents ?? 100;
    this.maxBytes = options.maxBytes ?? 128 * 1024;
    this.flushIntervalMs = options.flushIntervalMs;
  }

  shipToLogger({ data }: LogLayerTransportParams): unknown[] {
    const event = data?.event;
    if (!isExecutionLogEvent(event)) return [];

    this.buffer(event);
    if (this.shouldFlush(event)) void this.flushBuffer(bufferKey(event));
    else this.scheduleFlush();
    return [];
  }

  async flush(): Promise<void> {
    this.clearFlushTimer();
    const chunks = Array.from(this.buffers.keys())
      .map((key) => this.takeChunk(key))
      .filter((chunk): chunk is ExecutionLogChunk => chunk !== undefined);
    await this.enqueueFlush(async () => {
      await Promise.all(
        chunks.map((chunk) => Promise.resolve(this.options.store.appendChunk(chunk))),
      );
    });
  }

  async flushEntry(executionId: string, entryId?: string): Promise<void> {
    await this.flushBuffer(bufferKey({ executionId, entryId }));
  }

  async query(input: LogQuery): Promise<LogQueryResult> {
    const result = await this.options.store.queryChunks(input);
    const events = result.chunks
      .flatMap((chunk) => chunk.events)
      .filter((event) => {
        if (input.level && event.level !== input.level) return false;
        return true;
      })
      .sort(compareExecutionEvents);
    return {
      events: input.limit ? events.slice(0, input.limit) : events,
      nextCursor: result.nextCursor,
    };
  }

  queryChunks(input: ExecutionLogChunkQuery): Promise<ExecutionLogChunkQueryResult> {
    return this.options.store.queryChunks(input);
  }

  private buffer(event: ExecutionLogEvent) {
    const key = bufferKey(event);
    const events = this.buffers.get(key) ?? [];
    events.push(event);
    this.buffers.set(key, events);
  }

  private shouldFlush(event: ExecutionLogEvent) {
    const events = this.buffers.get(bufferKey(event));
    if (!events) return false;
    if (events.length >= this.maxEvents) return true;
    if (eventsByteLength(events) >= this.maxBytes) return true;
    return isTerminalEntryEvent(event) || isTerminalExecutionEvent(event);
  }

  private scheduleFlush() {
    if (!this.flushIntervalMs || this.flushTimer) return;
    this.flushTimer = setTimeout(() => void this.flush(), this.flushIntervalMs);
  }

  private clearFlushTimer() {
    if (!this.flushTimer) return;
    clearTimeout(this.flushTimer);
    this.flushTimer = undefined;
  }

  private flushBuffer(key: string) {
    const chunk = this.takeChunk(key);
    if (!chunk) return this.pendingFlush;
    return this.enqueueFlush(() => Promise.resolve(this.options.store.appendChunk(chunk)));
  }

  private enqueueFlush(fn: () => Promise<void>) {
    this.pendingFlush = this.pendingFlush.then(fn, fn);
    return this.pendingFlush;
  }

  private takeChunk(key: string): ExecutionLogChunk | undefined {
    const events = this.buffers.get(key);
    if (!events?.length) return undefined;
    this.buffers.delete(key);
    return this.createChunk(key, events);
  }

  private createChunk(key: string, events: ExecutionLogEvent[]): ExecutionLogChunk {
    const first = events[0];
    const last = events.at(-1);
    if (!first || !last) throw new Error("Cannot create execution log chunk without events");
    const nextSequence = (this.chunkSequences.get(key) ?? 0) + 1;
    this.chunkSequences.set(key, nextSequence);
    const entrySequences = events
      .map((event) => event.entrySequence)
      .filter((value): value is number => typeof value === "number");
    return {
      chunkId: `${first.executionId}:${first.entryId ?? "execution"}:${String(nextSequence).padStart(8, "0")}`,
      executionId: first.executionId,
      entryId: first.entryId,
      chunkSequence: nextSequence,
      eventCount: events.length,
      firstTimestamp: first.timestamp,
      lastTimestamp: last.timestamp,
      entrySequenceStart: entrySequences[0],
      entrySequenceEnd: entrySequences.at(-1),
      hasError: events.some((event) => event.level === "error"),
      events,
    };
  }
}

export function createExecutionLogStoreTransport(
  options: BufferedExecutionLogStoreTransportOptions,
) {
  return new BufferedExecutionLogStoreTransport(options);
}

export const createBufferedExecutionLogStoreTransport = createExecutionLogStoreTransport;

function bufferKey(input: Pick<ExecutionLogEvent, "executionId" | "entryId">) {
  return `${input.executionId}:${input.entryId ?? "execution"}`;
}

function eventsByteLength(events: ExecutionLogEvent[]) {
  return events.reduce((total, event) => total + JSON.stringify(event).length, 0);
}

function isTerminalEntryEvent(event: ExecutionLogEvent) {
  return event.kind === "entry.completed" || event.kind === "entry.failed";
}

function isTerminalExecutionEvent(event: ExecutionLogEvent) {
  return event.kind === "execution.completed" || event.kind === "execution.failed";
}

function compareExecutionEvents(left: ExecutionLogEvent, right: ExecutionLogEvent) {
  const timestampOrder = left.timestamp.localeCompare(right.timestamp);
  if (timestampOrder !== 0) return timestampOrder;
  return left.sequence.localeCompare(right.sequence);
}
