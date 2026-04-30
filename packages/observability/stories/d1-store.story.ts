import type { ExecutionLogChunk, ExecutionLogChunkQuery } from "../src/logging/event.ts";
import type { ExecutionLogStore } from "../src/logging/sinks/store.ts";

type D1DatabaseLike = {
  prepare(sql: string): D1PreparedStatementLike;
};

type D1PreparedStatementLike = {
  bind(...values: unknown[]): D1PreparedStatementLike;
  run(): Promise<unknown>;
  all<T>(): Promise<{ results: T[] }>;
};

type ExecutionLogChunkRow = {
  chunk_id: string;
  execution_id: string;
  entry_id: string | null;
  chunk_sequence: number;
  event_count: number;
  has_error: number;
  first_timestamp: string;
  last_timestamp: string;
  body: string;
};

export function createD1ExecutionLogStore(db: D1DatabaseLike): ExecutionLogStore {
  return {
    async appendChunk(chunk) {
      await db
        .prepare(
          `insert into execution_log_chunk (
            chunk_id,
            execution_id,
            entry_id,
            chunk_sequence,
            event_count,
            has_error,
            first_timestamp,
            last_timestamp,
            body
          ) values (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
        )
        .bind(
          chunk.chunkId,
          chunk.executionId,
          chunk.entryId ?? null,
          chunk.chunkSequence,
          chunk.eventCount,
          chunk.hasError ? 1 : 0,
          chunk.firstTimestamp,
          chunk.lastTimestamp,
          JSON.stringify(chunk),
        )
        .run();
    },
    async queryChunks(input) {
      const rows = await queryChunkRows(db, input);
      return {
        chunks: rows.map((row) => JSON.parse(row.body) as ExecutionLogChunk),
        nextCursor: rows.length === (input.limit ?? 50) ? rows.at(-1)?.chunk_id : undefined,
      };
    },
  };
}

async function queryChunkRows(db: D1DatabaseLike, input: ExecutionLogChunkQuery) {
  const limit = input.limit ?? 50;
  const where = ["execution_id = ?"];
  const values: unknown[] = [input.executionId];

  if (input.entryId) {
    where.push("entry_id = ?");
    values.push(input.entryId);
  }
  if (input.level === "error") {
    where.push("has_error = 1");
  }
  if (input.cursor) {
    where.push("chunk_id > ?");
    values.push(input.cursor);
  }

  const sql = `select * from execution_log_chunk
    where ${where.join(" and ")}
    order by chunk_id asc
    limit ?`;

  const result = await db
    .prepare(sql)
    .bind(...values, limit)
    .all<ExecutionLogChunkRow>();
  return result.results;
}
