import { integer, sqliteTable, text } from "drizzle-orm/sqlite-core";
import { uniqueId } from "@repo/utils/id";
import { timestamps, timestamptz } from "../../../../db/schema/d1/utils";

export const accountProfiles = sqliteTable("account_profile", {
  steamId: text("steam_id").primaryKey(),
  connectionId: text("connection_id").notNull(),
  personaName: text("persona_name"),
  avatarUrl: text("avatar_url"),
  profileUrl: text("profile_url"),
  metadata: text("metadata", { mode: "json" }),
  lastSyncedAt: timestamptz("last_synced_at"),
  ...timestamps,
});

export const families = sqliteTable("family", {
  id: text("id")
    .primaryKey()
    .$defaultFn(() => uniqueId()),
  ownerConnectionId: text("owner_connection_id").notNull(),
  name: text("name"),
  metadata: text("metadata", { mode: "json" }),
  lastSyncedAt: timestamptz("last_synced_at"),
  ...timestamps,
});

export const familyMembers = sqliteTable("family_member", {
  id: text("id")
    .primaryKey()
    .$defaultFn(() => uniqueId()),
  familyId: text("family_id").notNull(),
  steamId: text("steam_id").notNull(),
  role: text("role"),
  status: text("status").notNull().default("active"),
  joinedAt: timestamptz("joined_at"),
  leftAt: timestamptz("left_at"),
  metadata: text("metadata", { mode: "json" }),
  lastSyncedAt: timestamptz("last_synced_at"),
  ...timestamps,
});

export const appCatalog = sqliteTable("app_catalog", {
  appId: integer("app_id", { mode: "number" }).primaryKey(),
  name: text("name"),
  imageUrl: text("image_url"),
  headerImageUrl: text("header_image_url"),
  metadata: text("metadata", { mode: "json" }),
  updatedAt: timestamps.updatedAt,
});

export const familyLibraryItems = sqliteTable("family_library_item", {
  id: text("id")
    .primaryKey()
    .$defaultFn(() => uniqueId()),
  familyId: text("family_id").notNull(),
  appId: integer("app_id", { mode: "number" }).notNull(),
  ownerSteamIds: text("owner_steam_ids", { mode: "json" }).$type<string[]>().notNull(),
  acquiredAt: timestamptz("acquired_at"),
  metadata: text("metadata", { mode: "json" }),
  lastSyncedAt: timestamptz("last_synced_at"),
  ...timestamps,
});

export const userLibraryItems = sqliteTable("user_library_item", {
  id: text("id")
    .primaryKey()
    .$defaultFn(() => uniqueId()),
  steamId: text("steam_id").notNull(),
  appId: integer("app_id", { mode: "number" }).notNull(),
  playtimeMinutes: integer("playtime_minutes"),
  lastPlayedAt: timestamptz("last_played_at"),
  metadata: text("metadata", { mode: "json" }),
  lastSyncedAt: timestamptz("last_synced_at"),
  ...timestamps,
});
