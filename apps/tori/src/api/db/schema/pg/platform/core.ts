import { jsonb, text, timestamp } from "drizzle-orm/pg-core";
import { uniqueId } from "@repo/utils/id";
import { timestamps } from "../utils";
import { pgTable } from "./schema";

export const userProfiles = pgTable("user_profile", {
  userId: text("user_id").primaryKey(),
  displayName: text("display_name"),
  avatarUrl: text("avatar_url"),
  locale: text("locale"),
  timezone: text("timezone"),
  metadata: jsonb("metadata"),
  ...timestamps,
});

export const channels = pgTable("channel", {
  id: text("id")
    .primaryKey()
    .$defaultFn(() => uniqueId()),
  type: text("type").notNull(),
  name: text("name"),
  status: text("status").notNull().default("active"),
  metadata: jsonb("metadata"),
  createdByUserId: text("created_by_user_id"),
  deletedAt: timestamp("deleted_at"),
  ...timestamps,
});

export const auditLogs = pgTable("audit_log", {
  id: text("id")
    .primaryKey()
    .$defaultFn(() => uniqueId()),
  actorUserId: text("actor_user_id"),
  scopeType: text("scope_type").notNull(),
  scopeId: text("scope_id").notNull(),
  action: text("action").notNull(),
  payload: jsonb("payload"),
  createdAt: timestamps.createdAt,
});
