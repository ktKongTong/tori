import { pgTable, text, timestamp } from "drizzle-orm/pg-core";
import { sqliteTable, text as sqliteText } from "drizzle-orm/sqlite-core";
import { describe, expect, it } from "vite-plus/test";
import {
  accessedAt,
  aliasedColumn,
  commonTimeFields,
  createdAt,
  timestamptz,
  updatedAt,
} from "../src/schema/pg.ts";
import {
  booleanInt,
  commonTimeFields as sqliteCommonTimeFields,
  createdAt as sqliteCreatedAt,
  timestampMs,
  timestampSeconds,
  updatedAt as sqliteUpdatedAt,
} from "../src/schema/sqlite.ts";

describe("PostgreSQL schema helpers", () => {
  it("creates timestamp columns with project defaults", () => {
    const events = pgTable("events", {
      createdAt: createdAt(),
      updatedAt: updatedAt(),
      accessedAt: accessedAt(),
      expiresAt: timestamptz("expires_at", true),
    });

    expect(events.createdAt.name).toBe("created_at");
    expect(events.updatedAt.name).toBe("updated_at");
    expect(events.accessedAt.name).toBe("access_at");
    expect(events.expiresAt.name).toBe("expires_at");
    expect(commonTimeFields).toHaveProperty("createdAt");
  });

  it("aliases columns with their driver mapper", () => {
    const users = pgTable("users", {
      name: text("name"),
      createdAt: timestamp("created_at"),
    });

    expect(aliasedColumn(users.name, "display_name").fieldAlias).toBe("display_name");
  });
});

describe("SQLite schema helpers", () => {
  it("creates timestamp and boolean integer columns", () => {
    const events = sqliteTable("events", {
      id: sqliteText("id").primaryKey(),
      active: booleanInt("active").notNull().default(false),
      createdAt: sqliteCreatedAt(),
      updatedAt: sqliteUpdatedAt(),
      seenAt: timestampMs("seen_at"),
      syncedAt: timestampSeconds("synced_at"),
    });

    expect(events.active.name).toBe("active");
    expect(events.createdAt.name).toBe("created_at");
    expect(events.updatedAt.name).toBe("updated_at");
    expect(events.seenAt.name).toBe("seen_at");
    expect(events.syncedAt.name).toBe("synced_at");
    expect(sqliteCommonTimeFields).toHaveProperty("createdAt");
  });
});
