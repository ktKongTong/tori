import { sql } from "drizzle-orm";
import { boolean, jsonb, text, timestamp, uniqueIndex } from "drizzle-orm/pg-core";
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
    // soft delete
    deletedAt: timestamptz("deleted_at"),
    ...timestamps,
  },
  (table) => [
    uniqueIndex("uq_connection_identity")
      .on(table.ownerUserId, table.provider, table.providerAccountId, table.accessMode)
      .where(sql`${table.status} = 'active'`),
  ],
);

export const connectionCredentials = pgTable(
  "connection_credential",
  {
    id: text("id")
      .primaryKey()
      .$defaultFn(() => uniqueId()),
    connectionId: text("connection_id").notNull(),
    proxyInstanceId: text("proxy_instance_id").notNull(),
    kind: text("kind").notNull(),
    credentialRef: text("credential_ref").notNull(),
    status: text("status").notNull().default("active"),
    metadata: jsonb("metadata"),
    lastUsedAt: timestamp("last_used_at"),
    expiresAt: timestamp("expires_at"),
    ...timestamps,
  },
  (table) => [
    uniqueIndex("uq_active_connection_credential")
      .on(table.connectionId, table.kind)
      .where(sql`${table.status} = 'active'`),
  ],
);

export const tokenProxyConnectionSessions = pgTable(
  "token_proxy_connection_session",
  {
    id: text("id")
      .primaryKey()
      .$defaultFn(() => uniqueId()),
    state: text("state").notNull(),
    ownerUserId: text("owner_user_id").notNull(),
    proxyInstanceId: text("proxy_instance_id").notNull(),
    provider: text("provider").notNull(),
    accessMode: text("access_mode").notNull().default("proxy-token"),
    status: text("status").notNull().default("pending"),
    callbackUrl: text("callback_url").notNull(),
    tokenProxyConnectUrl: text("token_proxy_connect_url").notNull(),
    tokenProxyCode: text("token_proxy_code"),
    connectionId: text("connection_id"),
    error: text("error"),
    metadata: jsonb("metadata"),
    expiresAt: timestamp("expires_at").notNull(),
    completedAt: timestamp("completed_at"),
    ...timestamps,
  },
  (table) => [uniqueIndex("uq_token_proxy_connection_session_state").on(table.state)],
);
