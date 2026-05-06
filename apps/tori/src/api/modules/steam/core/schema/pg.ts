import { bigint, integer, jsonb, pgSchema, text } from "drizzle-orm/pg-core";
import { uniqueId } from "@repo/utils/id";
import { timestamps, timestamptz } from "../../../../db/schema/pg/utils.js";

export const steamSchema = pgSchema("steam");
const pgTable = steamSchema.table;

export const accountProfiles = pgTable("account_profile", {
  steamId: text("steam_id").primaryKey(),
  connectionId: text("connection_id").notNull(),
  personaName: text("persona_name"),
  avatarUrl: text("avatar_url"),
  profileUrl: text("profile_url"),
  metadata: jsonb("metadata"),
  lastSyncedAt: timestamptz("last_synced_at"),
  ...timestamps,
});

export const families = pgTable("family", {
  id: text("id")
    .primaryKey()
    .$defaultFn(() => uniqueId()),
  ownerConnectionId: text("owner_connection_id").notNull(),
  name: text("name"),
  metadata: jsonb("metadata"),
  lastSyncedAt: timestamptz("last_synced_at"),
  ...timestamps,
});

export const familyMembers = pgTable("family_member", {
  id: text("id")
    .primaryKey()
    .$defaultFn(() => uniqueId()),
  familyId: text("family_id").notNull(),
  steamId: text("steam_id").notNull(),
  role: text("role"),
  status: text("status").notNull().default("active"),
  joinedAt: timestamptz("joined_at"),
  leftAt: timestamptz("left_at"),
  metadata: jsonb("metadata"),
  lastSyncedAt: timestamptz("last_synced_at"),
  ...timestamps,
});

export const appCatalog = pgTable("app_catalog", {
  appId: bigint("app_id", { mode: "number" }).primaryKey(),
  name: text("name"),
  imageUrl: text("image_url"),
  headerImageUrl: text("header_image_url"),
  metadata: jsonb("metadata"),
  updatedAt: timestamps.updatedAt,
});

export const familyLibraryItems = pgTable("family_library_item", {
  id: text("id")
    .primaryKey()
    .$defaultFn(() => uniqueId()),
  familyId: text("family_id").notNull(),
  appId: bigint("app_id", { mode: "number" }).notNull(),
  ownerSteamIds: text("owner_steam_ids").array().notNull(),
  acquiredAt: timestamptz("acquired_at"),
  metadata: jsonb("metadata"),
  lastSyncedAt: timestamptz("last_synced_at"),
  ...timestamps,
});

export const userLibraryItems = pgTable("user_library_item", {
  id: text("id")
    .primaryKey()
    .$defaultFn(() => uniqueId()),
  steamId: text("steam_id").notNull(),
  appId: bigint("app_id", { mode: "number" }).notNull(),
  playtimeMinutes: integer("playtime_minutes"),
  lastPlayedAt: timestamptz("last_played_at"),
  metadata: jsonb("metadata"),
  lastSyncedAt: timestamptz("last_synced_at"),
  ...timestamps,
});
