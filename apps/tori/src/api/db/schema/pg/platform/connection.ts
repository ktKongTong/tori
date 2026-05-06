import { sql } from "drizzle-orm";
import { boolean, jsonb, text, uniqueIndex } from "drizzle-orm/pg-core";
import { uniqueId } from "@repo/utils/id";
import { requiredTimestamptz, timestamps, timestamptz } from "../utils.js";
import { pgTable } from "./schema.js";

export const connections = pgTable(
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
    isDefault: boolean("is_default").notNull().default(false),
    metadata: jsonb("metadata"),
    connectedAt: requiredTimestamptz("connected_at").defaultNow(),
    lastSyncedAt: timestamptz("last_synced_at"),
    ...timestamps,
  },
  (table) => [
    uniqueIndex("uq_connection_identity")
      .on(table.ownerUserId, table.provider, table.providerAccountId, table.accessMode)
      .where(sql`${table.status} = 'active'`),
  ],
);
