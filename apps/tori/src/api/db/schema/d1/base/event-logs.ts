import { index, integer, sqliteTable, text } from "drizzle-orm/sqlite-core";

export const eventLogs = sqliteTable(
  "otel_event_logs",
  {
    id: integer("id").primaryKey({ autoIncrement: true }),
    traceId: text("trace_id").notNull(),
    spanId: text("span_id").notNull(),
    correlationId: text("correlation_id").notNull(),
    seq: integer("seq").notNull(),
    level: text("level", { enum: ["info", "warn", "error", "debug"] }).notNull(),
    msg: text("msg").notNull(),
    meta: text("meta", { mode: "json" }),
    createdAt: integer("created_at", { mode: "timestamp_ms" }).notNull(),
  },
  (table) => [
    index("idx_trace_span").on(table.traceId, table.spanId),
    index("idx_otel_correlation_id").on(table.correlationId),
  ],
);
