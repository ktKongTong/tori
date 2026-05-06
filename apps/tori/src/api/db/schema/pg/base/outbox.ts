import { sql } from "drizzle-orm";
import { bigint, index, jsonb, pgTable, primaryKey, timestamp, varchar } from "drizzle-orm/pg-core";
import type { CausationType } from "@/api/domain/infra";

const outboxStatus = ["PENDING", "PROCESSING", "SENT"] as const;

export const processStatus = ["DONE", "PROCESSING", "FAIL"] as const;

export const outbox = pgTable(
  "outbox",
  {
    id: varchar("id").notNull().primaryKey(),
    source: varchar("source"),
    type: varchar("type").notNull(),
    correlationId: varchar("correlation_id").notNull(),
    causationId: varchar("causation_id").notNull(),
    causationType: varchar("causation_type").$type<CausationType>().notNull(),
    specVersion: varchar("spec_version").notNull(),
    timestamp: bigint("timestamp", { mode: "bigint" }).notNull(),
    actor: varchar("actor"),
    subject: varchar("subject"),
    payload: jsonb("payload"),
    extensions: jsonb("extensions").$type<Record<string, unknown>>(),
    // 格式: 00-{traceId}-{spanId}-{traceFlags}
    traceparent: varchar("traceparent"),
    tracestate: varchar("tracestate"),
    status: varchar("status", { enum: outboxStatus }).default("PENDING").notNull(),
    leaseToken: varchar("lease_token"),
    processingAt: timestamp("processing_at"),
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

export const inbox = pgTable(
  "inbox",
  {
    eventId: varchar("event_id").notNull(),
    handlerId: varchar("handler_id").notNull(),
    spanId: varchar("span_id"),
    traceparent: varchar("traceparent"),
    tracestate: varchar("tracestate"),
    extensions: jsonb("extensions"),
    status: varchar("status", { enum: processStatus }).notNull(),
    processedAt: timestamp("processed_at"),
    finishedAt: timestamp("finished_at"),
    reason: varchar("reason"),
  },
  (table) => [primaryKey({ columns: [table.eventId, table.handlerId] })],
);
