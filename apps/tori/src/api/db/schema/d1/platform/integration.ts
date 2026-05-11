import { sql } from "drizzle-orm";
import { integer, sqliteTable, text, uniqueIndex } from "drizzle-orm/sqlite-core";
import { uniqueId } from "@repo/utils/id";
import { timestamps, timestamptz } from "../utils";

export const proxyInstances = sqliteTable("proxy_instance", {
  id: text("id")
    .primaryKey()
    .$defaultFn(() => uniqueId()),
  ownerUserId: text("owner_user_id").notNull(),
  provider: text("provider").notNull(),
  name: text("name"),
  baseUrl: text("base_url").notNull(),
  credentialRef: text("credential_ref").notNull(),
  status: text("status").notNull().default("active"),
  healthStatus: text("health_status").notNull().default("healthy"),
  capabilities: text("capabilities", { mode: "json" }),
  metadata: text("metadata", { mode: "json" }),
  lastSeenAt: timestamptz("last_seen_at"),
  deletedAt: integer("deleted_at", { mode: "timestamp" }),
  ...timestamps,
});

export const botPluginInstances = sqliteTable(
  "bot_plugin_instance",
  {
    id: text("id")
      .primaryKey()
      .$defaultFn(() => uniqueId()),
    ownerUserId: text("owner_user_id").notNull(),
    platform: text("platform").notNull(),
    namespace: text("namespace"),
    instanceKey: text("instance_key").notNull(),
    displayName: text("display_name"),
    callbackMode: text("callback_mode").notNull().default("internal-sse"),
    deliveryEndpointId: text("delivery_endpoint_id"),
    status: text("status").notNull().default("active"),
    capabilities: text("capabilities", { mode: "json" }),
    metadata: text("metadata", { mode: "json" }),
    lastSeenAt: timestamptz("last_seen_at"),
    deletedAt: integer("deleted_at", { mode: "timestamp" }),
    ...timestamps,
  },
  (table) => [
    uniqueIndex("uq_bot_plugin_instance_identity")
      .on(table.ownerUserId, table.platform, table.namespace, table.instanceKey)
      .where(sql`${table.status} = 'active'`),
    uniqueIndex("uq_mock_bot_singleton")
      .on(table.platform)
      .where(sql`${table.platform} = 'mock' and ${table.status} = 'active'`),
  ],
);
