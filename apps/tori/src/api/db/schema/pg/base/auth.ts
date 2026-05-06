import * as t from "drizzle-orm/pg-core";
import { pgSchema } from "drizzle-orm/pg-core";
import { timestamptz } from "../utils";

export const authSchema = pgSchema("auth");
const pgTable = authSchema.table;
export const user = pgTable("user", {
  id: t.text("id").primaryKey(),
  name: t.text("name").notNull(),
  email: t.varchar("email", { length: 255 }).notNull().unique(),
  emailVerified: t.boolean("email_verified").notNull(),
  image: t.text("image"),
  createdAt: t.timestamp("created_at", { precision: 6, withTimezone: true }).notNull(),
  updatedAt: t.timestamp("updated_at", { precision: 6, withTimezone: true }).notNull(),
  // anonymous plugin
  isAnonymous: t.boolean("is_anonymous"),
  // admin plugin
  role: t.text("role"),
  banned: t.boolean("banned"),
  banReason: t.text("ban_reason"),
  banExpires: t.timestamp("ban_expires", { precision: 6, withTimezone: true }),
  // business-compatible additive columns
  status: t.text("status").notNull().default("active"),
  claimedAt: timestamptz("claimed_at"),
  mergedIntoUserId: t.text("merged_into_user_id"),
});

export const session = pgTable("session", {
  id: t.text("id").primaryKey(),
  userId: t
    .text("user_id")
    .notNull()
    .references(() => user.id, { onDelete: "cascade" }),
  token: t.varchar("token", { length: 255 }).notNull().unique(),
  expiresAt: t.timestamp("expires_at", { precision: 6, withTimezone: true }).notNull(),
  ipAddress: t.text("ip_address"),
  userAgent: t.text("user_agent"),
  createdAt: t.timestamp("created_at", { precision: 6, withTimezone: true }).notNull(),
  updatedAt: t.timestamp("updated_at", { precision: 6, withTimezone: true }).notNull(),
  // admin plugin
  impersonatedBy: t.text("impersonated_by"),
});

export const account = pgTable("account", {
  id: t.text("id").primaryKey(),
  userId: t
    .text("user_id")
    .notNull()
    .references(() => user.id, { onDelete: "cascade" }),
  accountId: t.text("account_id").notNull(),
  providerId: t.text("provider_id").notNull(),
  accessToken: t.text("access_token"),
  refreshToken: t.text("refresh_token"),
  accessTokenExpiresAt: t.timestamp("access_token_expires_at", {
    precision: 6,
    withTimezone: true,
  }),
  refreshTokenExpiresAt: t.timestamp("refresh_token_expires_at", {
    precision: 6,
    withTimezone: true,
  }),
  scope: t.text("scope"),
  idToken: t.text("id_token"),
  password: t.text("password"),
  createdAt: t.timestamp("created_at", { precision: 6, withTimezone: true }).notNull(),
  updatedAt: t.timestamp("updated_at", { precision: 6, withTimezone: true }).notNull(),
});

export const verification = pgTable("verification", {
  id: t.text("id").primaryKey(),
  identifier: t.text("identifier").notNull(),
  value: t.text("value").notNull(),
  expiresAt: t.timestamp("expires_at", { precision: 6, withTimezone: true }).notNull(),
  createdAt: t.timestamp("created_at", { precision: 6, withTimezone: true }).notNull(),
  updatedAt: t.timestamp("updated_at", { precision: 6, withTimezone: true }).notNull(),
});

export const apikey = pgTable("apikey", {
  id: t.text("id").primaryKey().unique(),
  configId: t.text("config_id").notNull(),
  name: t.text("name"),
  start: t.text("start"),
  prefix: t.text("prefix"),
  key: t.text("key").notNull(),
  referenceId: t.text("reference_id").notNull(),
  refillInterval: t.integer("refill_interval"),
  refillAmount: t.integer("refill_amount"),
  lastRefillAt: t.timestamp("last_refill_at", { precision: 6, withTimezone: true }),
  enabled: t.boolean("enabled"),
  rateLimitEnabled: t.boolean("rate_limit_enabled"),
  rateLimitTimeWindow: t.integer("rate_limit_time_window"),
  rateLimitMax: t.integer("rate_limit_max"),
  requestCount: t.integer("request_count"),
  remaining: t.integer("remaining"),
  lastRequest: t.timestamp("last_request", { precision: 6, withTimezone: true }),
  expiresAt: t.timestamp("expires_at", { precision: 6, withTimezone: true }),
  createdAt: t.timestamp("created_at", { precision: 6, withTimezone: true }).notNull(),
  updatedAt: t.timestamp("updated_at", { precision: 6, withTimezone: true }).notNull(),
  permissions: t.text("permissions"),
  metadata: t.text("metadata"),
});
