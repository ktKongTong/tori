import { index, integer, jsonb, pgTable, serial, text, timestamp } from "drizzle-orm/pg-core";

export const eventLogs = pgTable(
  "otel_event_logs",
  {
    id: serial("id").primaryKey(),
    traceId: text("trace_id").notNull(),
    spanId: text("span_id").notNull(),
    correlationId: text("correlation_id").notNull(),
    seq: integer("seq").notNull(),
    level: text("level", { enum: ["info", "warn", "error", "debug"] }).notNull(),
    msg: text("msg").notNull(),
    meta: jsonb("meta"),
    createdAt: timestamp("created_at").notNull(),
  },
  (table) => [
    index("idx_trace_span").on(table.traceId, table.spanId),
    index("idx_otel_correlation_id").on(table.correlationId),
  ],
);
