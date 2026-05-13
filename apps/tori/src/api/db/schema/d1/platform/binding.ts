import { sql } from "drizzle-orm";
import { integer, sqliteTable, text, uniqueIndex } from "drizzle-orm/sqlite-core";
import { uniqueId } from "@repo/utils/id";
import { requiredTimestamptz, timestamps, timestamptz } from "../utils";

export const bindingGrants = sqliteTable("binding_grant", {
  id: text("id")
    .primaryKey()
    .$defaultFn(() => uniqueId()),
  code: text("code").notNull().unique(),
  tokenHash: text("token_hash").notNull().unique(),
  purpose: text("purpose").notNull(),
  subjectType: text("subject_type").notNull(),
  subjectId: text("subject_id").notNull(),
  issuedByUserId: text("issued_by_user_id"),
  issuedFrom: text("issued_from").notNull(),
  issuedToSurface: text("issued_to_surface").notNull(),
  status: text("status").notNull().default("pending"),
  codeExpiresAt: requiredTimestamptz("code_expires_at"),
  tokenExpiresAt: requiredTimestamptz("token_expires_at"),
  consumedAt: timestamptz("consumed_at"),
  maxUses: integer("max_uses").notNull().default(1),
  usedCount: integer("used_count").notNull().default(0),
  metadata: text("metadata", { mode: "json" }),
  ...timestamps,
});

export const claimSessions = sqliteTable("claim_session", {
  id: text("id")
    .primaryKey()
    .$defaultFn(() => uniqueId()),
  initiatedFrom: text("initiated_from").notNull(),
  purpose: text("purpose").notNull(),
  subjectType: text("subject_type").notNull(),
  subjectId: text("subject_id"),
  anonymousUserId: text("anonymous_user_id"),
  anonymousUserName: text("anonymous_user_name"),
  observedUserPlatform: text("observed_user_platform"),
  observedUserId: text("observed_user_id"),
  observedUserName: text("observed_user_name"),
  observedUserNamespace: text("observed_user_namespace"),
  observedChannelPlatform: text("observed_channel_platform"),
  observedChannelId: text("observed_channel_id"),
  observedChannelName: text("observed_channel_name"),
  observedChannelNamespace: text("observed_channel_namespace"),
  grantId: text("grant_id"),
  status: text("status").notNull(),
  resolvedUserId: text("resolved_user_id"),
  resolvedChannelId: text("resolved_channel_id"),
  resolution: text("resolution"),
  metadata: text("metadata", { mode: "json" }),
  ...timestamps,
  resolvedAt: timestamptz("resolved_at"),
});

export const userBindings = sqliteTable(
  "user_binding",
  {
    id: text("id")
      .primaryKey()
      .$defaultFn(() => uniqueId()),
    userId: text("user_id").notNull(),
    platform: text("platform").notNull(),
    externalUserId: text("external_user_id").notNull(),
    externalUserName: text("external_user_name"),
    namespace: text("namespace"),
    source: text("source").notNull(),
    assurance: text("assurance").notNull(),
    establishedByGrantId: text("established_by_grant_id"),
    metadata: text("metadata", { mode: "json" }),
    deletedAt: integer("deleted_at", { mode: "timestamp" }),
    ...timestamps,
  },
  (table) => [
    uniqueIndex("uq_user_binding_identity")
      .on(table.platform, table.externalUserId, table.namespace)
      .where(sql`${table.deletedAt} IS NULL`),
  ],
);

export const channelBindings = sqliteTable(
  "channel_binding",
  {
    id: text("id")
      .primaryKey()
      .$defaultFn(() => uniqueId()),
    channelId: text("channel_id").notNull(),
    platform: text("platform").notNull(),
    externalChannelId: text("external_channel_id").notNull(),
    externalChannelName: text("external_channel_name"),
    namespace: text("namespace"),
    botPluginInstanceId: text("bot_plugin_instance_id"),
    source: text("source").notNull(),
    assurance: text("assurance").notNull(),
    establishedByGrantId: text("established_by_grant_id"),
    status: text("status").notNull().default("active"),
    suspendedReason: text("suspended_reason"),
    metadata: text("metadata", { mode: "json" }),
    deletedAt: integer("deleted_at", { mode: "timestamp" }),
    ...timestamps,
  },
  (table) => [
    uniqueIndex("uq_channel_binding_identity")
      .on(table.platform, table.externalChannelId, table.namespace)
      .where(sql`${table.deletedAt} IS NULL`),
  ],
);

export const compensationCases = sqliteTable("compensation_case", {
  id: text("id")
    .primaryKey()
    .$defaultFn(() => uniqueId()),
  caseType: text("case_type").notNull(),
  status: text("status").notNull(),
  openedByUserId: text("opened_by_user_id"),
  relatedUserBindingId: text("related_user_binding_id"),
  relatedChannelBindingId: text("related_channel_binding_id"),
  targetUserId: text("target_user_id"),
  targetChannelId: text("target_channel_id"),
  reason: text("reason"),
  resolution: text("resolution"),
  metadata: text("metadata", { mode: "json" }),
  ...timestamps,
  closedAt: timestamptz("closed_at"),
});
