import { sql } from "drizzle-orm";
import { sqliteTable, text, uniqueIndex } from "drizzle-orm/sqlite-core";
import { uniqueId } from "@repo/utils/id";
import type { NotificationBody } from "@/api/modules/platform/notify/body.ts";
import { timestamps, timestamptz } from "../utils";

export const deliveryEndpoints = sqliteTable(
  "delivery_endpoint",
  {
    id: text("id")
      .primaryKey()
      .$defaultFn(() => uniqueId()),
    ownerUserId: text("owner_user_id"),
    platform: text("platform").notNull(),
    kind: text("kind").notNull(),
    displayName: text("display_name"),
    target: text("target").notNull(),
    secret: text("secret"),
    status: text("status").notNull().default("active"),
    config: text("config", { mode: "json" }),
    metadata: text("metadata", { mode: "json" }),
    lastUsedAt: timestamptz("last_used_at"),
    ...timestamps,
  },
  (table) => [
    uniqueIndex("uq_delivery_endpoint_target")
      .on(table.platform, table.kind, table.target)
      .where(sql`${table.status} = 'active'`),
  ],
);

export const subscriptions = sqliteTable("subscription", {
  id: text("id")
    .primaryKey()
    .$defaultFn(() => uniqueId()),
  channelId: text("channel_id").notNull(),
  botPluginInstanceId: text("bot_plugin_instance_id").notNull(),
  connectionId: text("connection_id").notNull(),
  ownerType: text("owner_type").notNull(),
  ownerId: text("owner_id").notNull(),
  topicType: text("topic_type").notNull(),
  topicKey: text("topic_key").notNull(),
  eventTypes: text("event_types", { mode: "json" }).$type<string[]>().notNull(),
  status: text("status").notNull().default("active"),
  filterExpr: text("filter_expr", { mode: "json" }),
  createdByUserId: text("created_by_user_id"),
  ...timestamps,
});

export const notificationEvents = sqliteTable("notification_event", {
  id: text("id")
    .primaryKey()
    .$defaultFn(() => uniqueId()),
  subscriptionId: text("subscription_id"),
  channelId: text("channel_id").notNull(),
  botPluginInstanceId: text("bot_plugin_instance_id"),
  deliveryEndpointId: text("delivery_endpoint_id"),
  channelBindingId: text("channel_binding_id"),
  title: text("title"),
  body: text("body", { mode: "json" }).$type<NotificationBody>().notNull(),
  payload: text("payload", { mode: "json" }).notNull(),
  status: text("status").notNull().default("pending"),
  sentAt: timestamptz("sent_at"),
  failedAt: timestamptz("failed_at"),
  errorMessage: text("error_message"),
  createdAt: timestamps.createdAt,
});
