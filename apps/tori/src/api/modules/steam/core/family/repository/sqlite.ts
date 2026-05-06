import { and, count, desc, eq, ilike, isNull, or, sql } from "drizzle-orm";

import { appCatalog, families, familyLibraryItems, familyMembers } from "../../schema/d1.js";
import type { SqliteDB } from "@/api/domain/infra/db";
import { chunkArray, WRITE_BATCH_SIZE } from "@/api/modules/steam/core/shared/utils";
import type {
  ISteamFamilyRepository,
  QueryFamilyLibraryRowsInput,
  ReplaceFamilyLibraryItemsInput,
  ReplaceFamilyMembersInput,
  UpsertFamilyInput,
} from "./repository";

export class SteamFamilySqliteRepository implements ISteamFamilyRepository {
  constructor(private readonly db: SqliteDB) {}

  async upsertFamily(input: UpsertFamilyInput) {
    const [row] = await this.db
      .insert(families)
      .values({
        id: input.id,
        ownerConnectionId: input.ownerConnectionId,
        name: input.name ?? null,
        metadata: input.metadata ?? null,
        lastSyncedAt: input.lastSyncedAt,
      })
      .onConflictDoUpdate({
        target: families.id,
        set: {
          ownerConnectionId: input.ownerConnectionId,
          name: input.name ?? null,
          metadata: input.metadata ?? null,
          lastSyncedAt: input.lastSyncedAt,
          updatedAt: input.lastSyncedAt,
        },
      })
      .returning();
    return row;
  }

  async replaceFamilyMembers(input: ReplaceFamilyMembersInput) {
    await this.db.delete(familyMembers).where(eq(familyMembers.familyId, input.familyId));
    if (input.items.length === 0) return [];
    const rows = [];
    for (const chunk of chunkArray(input.items, WRITE_BATCH_SIZE)) {
      const inserted = await this.db
        .insert(familyMembers)
        .values(
          chunk.map((item) => ({
            familyId: input.familyId,
            steamId: item.steamId,
            role: item.role ?? null,
            metadata: item.metadata ?? null,
            lastSyncedAt: item.lastSyncedAt,
          })),
        )
        .returning();
      rows.push(...inserted);
    }
    return rows;
  }

  async replaceFamilyLibraryItems(input: ReplaceFamilyLibraryItemsInput) {
    await this.db.delete(familyLibraryItems).where(eq(familyLibraryItems.familyId, input.familyId));
    if (input.items.length === 0) return [];
    const rows = [];
    for (const chunk of chunkArray(input.items, WRITE_BATCH_SIZE)) {
      const inserted = await this.db
        .insert(familyLibraryItems)
        .values(
          chunk.map((item) => ({
            familyId: input.familyId,
            appId: item.appId,
            ownerSteamIds: item.ownerSteamIds,
            acquiredAt: item.acquiredAt ?? undefined,
            metadata: item.metadata ?? null,
            lastSyncedAt: item.lastSyncedAt,
          })),
        )
        .returning();
      rows.push(...inserted);
    }
    return rows;
  }

  async findFamilyByOwnerConnectionId(connectionId: string) {
    const [row] = await this.db
      .select()
      .from(families)
      .where(eq(families.ownerConnectionId, connectionId))
      .limit(1);
    return row ?? null;
  }

  async listFamilyMembersByFamilyId(familyId: string) {
    return this.db.select().from(familyMembers).where(eq(familyMembers.familyId, familyId));
  }

  async listFamilyLibraryItemsByFamilyId(familyId: string) {
    return this.db
      .select()
      .from(familyLibraryItems)
      .where(eq(familyLibraryItems.familyId, familyId));
  }

  async listMissingCatalogAppIdsByFamilyId(familyId: string) {
    const rows = await this.db
      .select({
        appId: familyLibraryItems.appId,
      })
      .from(familyLibraryItems)
      .leftJoin(appCatalog, eq(familyLibraryItems.appId, appCatalog.appId))
      .where(and(eq(familyLibraryItems.familyId, familyId), isNull(appCatalog.appId)))
      .groupBy(familyLibraryItems.appId);
    return rows.map((row: { appId: number }) => Number(row.appId));
  }

  async countFamilyLibraryItemsByFamilyId(familyId: string) {
    const [row] = await this.db
      .select({ value: count() })
      .from(familyLibraryItems)
      .where(eq(familyLibraryItems.familyId, familyId));
    return row?.value ?? 0;
  }

  async countFamilyLibraryMatchesByFamilyId(familyId: string, query?: string | null) {
    const normalizedQuery = query?.trim();
    const whereClause = normalizedQuery
      ? and(
          eq(familyLibraryItems.familyId, familyId),
          or(
            ilike(appCatalog.name, `%${normalizedQuery}%`),
            sql`cast(${familyLibraryItems.appId} as text) ilike ${`%${normalizedQuery}%`}`,
          ),
        )
      : eq(familyLibraryItems.familyId, familyId);

    const [row] = await this.db
      .select({ value: count() })
      .from(familyLibraryItems)
      .leftJoin(appCatalog, eq(familyLibraryItems.appId, appCatalog.appId))
      .where(whereClause);

    return row?.value ?? 0;
  }

  async queryFamilyLibraryRows(input: QueryFamilyLibraryRowsInput) {
    const normalizedQuery = input.query?.trim();
    const whereClause = normalizedQuery
      ? and(
          eq(familyLibraryItems.familyId, input.familyId),
          or(
            ilike(appCatalog.name, `%${normalizedQuery}%`),
            sql`cast(${familyLibraryItems.appId} as text) ilike ${`%${normalizedQuery}%`}`,
          ),
        )
      : eq(familyLibraryItems.familyId, input.familyId);

    return this.db
      .select({
        appId: familyLibraryItems.appId,
        ownerSteamIds: familyLibraryItems.ownerSteamIds,
        acquiredAt: familyLibraryItems.acquiredAt,
        itemMetadata: familyLibraryItems.metadata,
        name: appCatalog.name,
        imageUrl: appCatalog.imageUrl,
        headerImageUrl: appCatalog.headerImageUrl,
      })
      .from(familyLibraryItems)
      .leftJoin(appCatalog, eq(familyLibraryItems.appId, appCatalog.appId))
      .where(whereClause)
      .orderBy(desc(familyLibraryItems.acquiredAt), appCatalog.name, familyLibraryItems.appId)
      .limit(input.limit)
      .offset(input.offset);
  }
}
