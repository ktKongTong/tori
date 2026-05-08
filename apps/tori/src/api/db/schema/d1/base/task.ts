import { integer, sqliteTable, text } from "drizzle-orm/sqlite-core";
import { uniqueId } from "@repo/utils/id";
import { timestamps, timestamptz } from "../utils";

export const taskDefinitions = sqliteTable("task_definition", {
  id: text("id")
    .primaryKey()
    .$defaultFn(() => uniqueId()),
  ownerUserId: text("owner_user_id"),
  kind: text("kind").notNull(),
  enabled: integer("enabled", { mode: "boolean" }).notNull().default(true),
  schedule: text("schedule").notNull(),
  payload: text("payload", { mode: "json" }).notNull(),
  lastTriggeredAt: timestamptz("last_triggered_at"),
  lastRunAt: timestamptz("last_run_at"),
  lastRunStatus: text("last_run_status"),
  lastError: text("last_error"),
  metadata: text("metadata", { mode: "json" }),
  ...timestamps,
});

export const taskRuns = sqliteTable("task_run", {
  id: text("id")
    .primaryKey()
    .$defaultFn(() => uniqueId()),
  name: text("name"),
  index: text("index"),
  taskDefinitionId: text("task_definition_id").notNull(),
  kind: text("kind").notNull(),
  status: text("status").notNull(),
  summary: text("summary", { mode: "json" }),
  errorMessage: text("error_message"),
  scheduledFor: timestamptz("scheduled_for"),
  startedAt: timestamptz("started_at"),
  finishedAt: timestamptz("finished_at"),
  createdAt: timestamps.createdAt,
});
