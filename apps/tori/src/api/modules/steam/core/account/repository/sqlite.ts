import { eq } from "drizzle-orm";

import { accountProfiles, userLibraryItems } from "../../schema/d1.js";
import type { SqliteDB } from "@/api/domain/infra/db";
import { chunkArray, WRITE_BATCH_SIZE } from "@/api/modules/steam/core/shared/utils";
import type {
  ISteamAccountRepository,
  ReplaceUserLibraryItemsInput,
  UpsertAccountProfileInput,
} from "./repository";

export class SteamAccountSqliteRepository implements ISteamAccountRepository {
  constructor(private readonly db: SqliteDB) {}

  async upsertAccountProfile(input: UpsertAccountProfileInput) {
    const [row] = await this.db
      .insert(accountProfiles)
      .values({
        steamId: input.steamId,
        connectionId: input.connectionId,
        personaName: input.personaName ?? null,
        avatarUrl: input.avatarUrl ?? null,
        profileUrl: input.profileUrl ?? null,
        metadata: input.metadata ?? null,
        lastSyncedAt: input.lastSyncedAt,
      })
      .onConflictDoUpdate({
        target: accountProfiles.steamId,
        set: {
          connectionId: input.connectionId,
          personaName: input.personaName ?? null,
          avatarUrl: input.avatarUrl ?? null,
          profileUrl: input.profileUrl ?? null,
          metadata: input.metadata ?? null,
          lastSyncedAt: input.lastSyncedAt,
        },
      })
      .returning();
    return row;
  }

  async replaceUserLibraryItems(input: ReplaceUserLibraryItemsInput) {
    await this.db.delete(userLibraryItems).where(eq(userLibraryItems.steamId, input.steamId));
    if (input.items.length === 0) return [];
    const rows = [];
    for (const chunk of chunkArray(input.items, WRITE_BATCH_SIZE)) {
      const inserted = await this.db
        .insert(userLibraryItems)
        .values(
          chunk.map((item) => ({
            steamId: input.steamId,
            appId: item.appId,
            playtimeMinutes: item.playtimeMinutes ?? null,
            lastPlayedAt: item.lastPlayedAt ?? undefined,
            metadata: item.metadata ?? null,
            lastSyncedAt: item.lastSyncedAt,
          })),
        )
        .returning();
      rows.push(...inserted);
    }
    return rows;
  }

  async findAccountProfileByConnectionId(connectionId: string) {
    const [row] = await this.db
      .select()
      .from(accountProfiles)
      .where(eq(accountProfiles.connectionId, connectionId))
      .limit(1);
    return row ?? null;
  }
}
