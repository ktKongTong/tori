import { sql } from "drizzle-orm";

import { appCatalog } from "../../schema/d1.js";
import type { SqliteDB } from "@/api/domain/infra/db";
import { chunkArray, WRITE_BATCH_SIZE } from "@/api/modules/steam/core/shared/utils";
import type { ISteamCatalogRepository, UpsertAppCatalogEntriesInput } from "./repository";

export class SteamCatalogSqliteRepository implements ISteamCatalogRepository {
  constructor(private readonly db: SqliteDB) {}

  async upsertAppCatalogEntries(input: UpsertAppCatalogEntriesInput) {
    if (input.items.length === 0) return [];
    const rows = [];
    for (const chunk of chunkArray(input.items, WRITE_BATCH_SIZE)) {
      const inserted = await this.db
        .insert(appCatalog)
        .values(
          chunk.map((item) => ({
            appId: item.appId,
            name: item.name ?? null,
            imageUrl: item.imageUrl ?? null,
            headerImageUrl: item.headerImageUrl ?? null,
            metadata: item.metadata ?? null,
            updatedAt: item.updatedAt,
          })),
        )
        .onConflictDoUpdate({
          target: appCatalog.appId,
          set: {
            name: sql`excluded.name`,
            imageUrl: sql`excluded.image_url`,
            headerImageUrl: sql`excluded.header_image_url`,
            metadata: sql`excluded.metadata`,
            updatedAt: sql`excluded.updated_at`,
          },
        })
        .returning();
      rows.push(...inserted);
    }
    return rows;
  }
}
