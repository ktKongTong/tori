import { sql } from "drizzle-orm";
import { integer, sqliteTable, text, uniqueIndex } from "drizzle-orm/sqlite-core";
import { uniqueId } from "@repo/utils/id";
import { requiredTimestamptz, timestamps, timestamptz } from "../utils";

export const connections = sqliteTable(
  "connection",
  {
    id: text("id")
      .primaryKey()
      .$defaultFn(() => uniqueId()),
    ownerUserId: text("owner_user_id").notNull(),
    proxyInstanceId: text("proxy_instance_id"),
    provider: text("provider").notNull(),
    providerAccountId: text("provider_account_id").notNull(),
    providerAccountName: text("provider_account_name"),
    providerAccountAvatar: text("provider_account_avatar"),
    accessMode: text("access_mode").notNull(),
    status: text("status").notNull().default("active"),
    isDefault: integer("is_default", { mode: "boolean" }).notNull().default(false),
    metadata: text("metadata", { mode: "json" }),
    connectedAt: requiredTimestamptz("connected_at"),
    lastSyncedAt: timestamptz("last_synced_at"),
    deletedAt: integer("deleted_at", { mode: "timestamp" }),
    ...timestamps,
  },
  (table) => [
    uniqueIndex("uq_connection_identity")
      .on(table.ownerUserId, table.provider, table.providerAccountId, table.accessMode)
      .where(sql`${table.status} = 'active'`),
  ],
);
