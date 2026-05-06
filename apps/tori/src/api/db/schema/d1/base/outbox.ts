import { sql } from "drizzle-orm";
import { index, integer, primaryKey, sqliteTable, text } from "drizzle-orm/sqlite-core";
import type { CausationType } from "@/api/domain/infra";

const outboxStatus = ["PENDING", "PROCESSING", "SENT"] as const;
export const processStatus = ["DONE", "PROCESSING", "FAIL"] as const;

export const outbox = sqliteTable(
  "outbox",
  {
    id: text("id").notNull().primaryKey(),
    source: text("source"),
    type: text("type").notNull(),
    correlationId: text("correlation_id").notNull(),
    causationId: text("causation_id").notNull(),
    causationType: text("causation_type").$type<CausationType>().notNull(),
    specVersion: text("spec_version").notNull(),
    timestamp: integer("timestamp", { mode: "number" }).notNull(),
    actor: text("actor"),
    subject: text("subject"),
    payload: text("payload", { mode: "json" }),
    extensions: text("extensions", { mode: "json" }).$type<Record<string, unknown>>(),
    traceparent: text("traceparent"),
    tracestate: text("tracestate"),
    status: text("status", { enum: outboxStatus }).default("PENDING").notNull(),
    leaseToken: text("lease_token"),
    processingAt: integer("processing_at", { mode: "timestamp_ms" }),
  },
  (table) => [
    index("source_idx").on(table.source),
    index("type_idx").on(table.type),
    index("outbox_polling_idx")
      .on(table.status, table.timestamp)
      .where(sql`${table.status} = 'PENDING'`),
    index("outbox_processing_idx")
      .on(table.status, table.processingAt)
      .where(sql`${table.status} = 'PROCESSING'`),
  ],
);

export const inbox = sqliteTable(
  "inbox",
  {
    eventId: text("event_id").notNull(),
    handlerId: text("handler_id").notNull(),
    spanId: text("span_id"),
    traceparent: text("traceparent"),
    tracestate: text("tracestate"),
    extensions: text("extensions", { mode: "json" }),
    status: text("status", { enum: processStatus }).notNull(),
    processedAt: integer("processed_at", { mode: "timestamp_ms" }),
    finishedAt: integer("finished_at", { mode: "timestamp_ms" }),
    reason: text("reason"),
  },
  (table) => [primaryKey({ columns: [table.eventId, table.handlerId] })],
);
