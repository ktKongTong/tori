import { sqliteTable, text } from "drizzle-orm/sqlite-core";
import { uniqueId } from "@repo/utils/id";
import { timestamps } from "../utils";

export const userProfiles = sqliteTable("user_profile", {
  userId: text("user_id").primaryKey(),
  displayName: text("display_name"),
  avatarUrl: text("avatar_url"),
  locale: text("locale"),
  timezone: text("timezone"),
  metadata: text("metadata", { mode: "json" }),
  ...timestamps,
});

export const channels = sqliteTable("channel", {
  id: text("id")
    .primaryKey()
    .$defaultFn(() => uniqueId()),
  type: text("type").notNull(),
  name: text("name"),
  status: text("status").notNull().default("active"),
  metadata: text("metadata", { mode: "json" }),
  createdByUserId: text("created_by_user_id"),
  ...timestamps,
});

export const auditLogs = sqliteTable("audit_log", {
  id: text("id")
    .primaryKey()
    .$defaultFn(() => uniqueId()),
  actorUserId: text("actor_user_id"),
  scopeType: text("scope_type").notNull(),
  scopeId: text("scope_id").notNull(),
  action: text("action").notNull(),
  payload: text("payload", { mode: "json" }),
  createdAt: timestamps.createdAt,
});
