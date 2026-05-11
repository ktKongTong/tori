import { boolean, jsonb, pgSchema, text, timestamp } from "drizzle-orm/pg-core";
import { uniqueId } from "@repo/utils/id";
import { timestamps, timestamptz } from "../utils";

export const taskSchema = pgSchema("task");
const pgTable = taskSchema.table;

export const taskDefinitions = pgTable("definition", {
  id: text("id")
    .primaryKey()
    .$defaultFn(() => uniqueId()),
  ownerUserId: text("owner_user_id"),
  kind: text("kind").notNull(),
  enabled: boolean("enabled").notNull().default(true),
  schedule: text("schedule").notNull(),
  payload: jsonb("payload").notNull(),
  lastTriggeredAt: timestamptz("last_triggered_at"),
  lastRunAt: timestamptz("last_run_at"),
  lastRunStatus: text("last_run_status"),
  lastError: text("last_error"),
  metadata: jsonb("metadata"),
  // soft delete
  deletedAt: timestamp("deleted_at"),
  ...timestamps,
});

export const taskRuns = pgTable("run", {
  id: text("id")
    .primaryKey()
    .$defaultFn(() => uniqueId()),
  taskDefinitionId: text("task_definition_id").notNull(),
  kind: text("kind").notNull(),
  status: text("status").notNull(),
  summary: jsonb("summary"),
  errorMessage: text("error_message"),
  scheduledFor: timestamptz("scheduled_for"),
  startedAt: timestamptz("started_at"),
  finishedAt: timestamptz("finished_at"),
  createdAt: timestamps.createdAt,
});
