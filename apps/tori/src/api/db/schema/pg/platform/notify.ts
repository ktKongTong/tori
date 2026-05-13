import { sql } from "drizzle-orm";
import { jsonb, text, uniqueIndex, timestamp } from "drizzle-orm/pg-core";
import { uniqueId } from "@repo/utils/id";
import type { NotificationBody } from "@/api/modules/platform/notification/notification/body.ts";
import { timestamps, timestamptz } from "../utils";
import { pgTable } from "./schema";

export const deliveryEndpoints = pgTable(
  "delivery_endpoint",
  {
    id: text("id")
      .primaryKey()
      .$defaultFn(() => uniqueId()),
    ownerUserId: text("owner_user_id"),
    platform: text("platform").notNull(),
    kind: text("kind").notNull(),
    name: text("name"),
    target: text("target").notNull(),
    secret: text("secret"),
    status: text("status").notNull().default("active"),
    config: jsonb("config"),
    metadata: jsonb("metadata"),
    lastUsedAt: timestamptz("last_used_at"),
    deletedAt: timestamp("deleted_at"),
    ...timestamps,
  },
  (table) => [
    uniqueIndex("uq_delivery_endpoint_target")
      .on(table.platform, table.kind, table.target)
      .where(sql`${table.deletedAt} IS NULL`),
  ],
);

export const subscriptions = pgTable("subscription", {
  id: text("id")
    .primaryKey()
    .$defaultFn(() => uniqueId()),
  channelId: text("channel_id").notNull(),
  connectionId: text("connection_id").notNull(),
  ownerType: text("owner_type").notNull(), // USER | CHANNEL
  ownerId: text("owner_id").notNull(),
  topicType: text("topic_type").notNull(),
  topicKey: text("topic_key").notNull(),
  eventTypes: text("event_types").array().notNull(),
  status: text("status").notNull().default("active"),
  filterExpr: jsonb("filter_expr"),
  createdByUserId: text("created_by_user_id"),
  deletedAt: timestamp("deleted_at"),
  ...timestamps,
});

export const notificationEvents = pgTable("notification_event", {
  id: text("id")
    .primaryKey()
    .$defaultFn(() => uniqueId()),
  subscriptionId: text("subscription_id"),
  channelId: text("channel_id").notNull(),
  botPluginInstanceId: text("bot_plugin_instance_id"),
  deliveryEndpointId: text("delivery_endpoint_id"),
  channelBindingId: text("channel_binding_id"),
  title: text("title"),
  body: jsonb("body").$type<NotificationBody>().notNull(),
  payload: jsonb("payload").notNull(),
  status: text("status").notNull().default("pending"),
  sentAt: timestamptz("sent_at"),
  failedAt: timestamptz("failed_at"),
  errorMessage: text("error_message"),
  createdAt: timestamps.createdAt,
});
