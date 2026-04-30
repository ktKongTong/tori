import type { ExecutionLogChunk, ExecutionLogEvent, LogLevel } from "../src/logging/event.ts";
import type { ExecutionLogStore } from "../src/logging/sinks/store.ts";

type RequestLike = {
  params: Record<string, string>;
  query: Record<string, string | undefined>;
};

export async function getExecutionLogs(request: RequestLike, store: ExecutionLogStore) {
  const executionId = request.params.executionId;
  const entryId = request.query.entryId;
  const level = request.query.level as LogLevel | undefined;
  const cursor = request.query.cursor;
  const limit = request.query.limit ? Number(request.query.limit) : 50;

  const result = await store.queryChunks({
    executionId,
    entryId,
    level,
    cursor,
    limit,
  });

  return {
    executionId,
    events: expandChunks(result.chunks, level),
    nextCursor: result.nextCursor,
  };
}

export function renderExecutionLogList(events: ExecutionLogEvent[]) {
  return events.map((event) => ({
    id: event.sequence,
    time: event.timestamp,
    level: event.level,
    message: event.message,
    entryId: event.entryId,
    stepId: event.stepId,
    error: event.error?.message,
  }));
}

function expandChunks(chunks: ExecutionLogChunk[], level?: LogLevel) {
  return chunks
    .flatMap((chunk) => chunk.events)
    .filter((event) => !level || event.level === level)
    .sort((left, right) => {
      const timestampOrder = left.timestamp.localeCompare(right.timestamp);
      if (timestampOrder !== 0) return timestampOrder;
      return left.sequence.localeCompare(right.sequence);
    });
}
