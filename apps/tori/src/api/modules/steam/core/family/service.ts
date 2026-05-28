import { ParameterError } from "@/api/domain/error";
import { createOutboxEventFromCtx } from "@/api/domain/infra";
import type { ServiceContext } from "@/api/domain/infra/service-context";
import { getSteamCatalogRepository } from "@/api/modules/steam/core/catalog/repository";
import {
  resolveOwnedConnection,
  resolveSteamFamilyAccess,
} from "@/api/modules/steam/core/connection/access";
import { getSteamFamilyRepository } from "@/api/modules/steam/core/family/repository";
import type {
  GetSteamFamilyInfoInput,
  QuerySteamFamilyLibraryInput,
  RefreshSteamFamilyInput,
  SteamFamilyLibraryChangedPayload,
  TokenProxySteamFamilyLibraryResponse,
  TokenProxySteamItemsResponse,
} from "./types";
import {
  buildSteamAvatarUrl,
  TOKEN_PROXY_ITEM_BATCH_SIZE,
  toDateFromUnixSeconds,
  toJsonRecord,
} from "@/api/modules/steam/core/shared/utils";
import {
  getSteamFamilyForConnection,
  getSteamFamilySharedLibrary,
  getSteamItemsByAppIds,
} from "./steam-web-api";

export async function refreshSteamFamily(ctx: ServiceContext, input: RefreshSteamFamilyInput) {
  console.log("Refreshing Steam family");
  const catalogRepository = getSteamCatalogRepository(ctx);
  const familyRepository = getSteamFamilyRepository(ctx);
  const access = await resolveSteamFamilyAccess(ctx, input.connectionId, input.ownerUserId);
  const existingFamily = await familyRepository.findFamilyByOwnerConnectionId(access.connection.id);
  const previousLibraryItems = existingFamily
    ? await familyRepository.listFamilyLibraryItemsByFamilyId(existingFamily.id)
    : [];

  const familyPayload = await getSteamFamilyForConnection(access);
  const libraryPayload = await getSteamFamilySharedLibrary(access, familyPayload.familyId);

  const syncedAt = new Date();
  const previousByAppId = new Map(
    previousLibraryItems.map((item: { appId: number; metadata: unknown }) => {
      const metadata = toJsonRecord(item.metadata);
      return [
        Number(item.appId),
        {
          appId: Number(item.appId),
          name: typeof metadata?.name === "string" ? metadata.name : null,
          imageUrl: typeof metadata?.imageUrl === "string" ? metadata.imageUrl : null,
          headerImageUrl:
            typeof metadata?.headerImageUrl === "string" ? metadata.headerImageUrl : null,
          ownerSteamIds:
            "ownerSteamIds" in item && Array.isArray(item.ownerSteamIds) ? item.ownerSteamIds : [],
        },
      ];
    }),
  );
  const visibleApps = libraryPayload.apps.filter(
    (item: TokenProxySteamFamilyLibraryResponse["apps"][number]) =>
      item.excludeReason == null || item.excludeReason === 0,
  );
  const uniqueAppIds = [...new Set(visibleApps.map((item) => item.appId))];
  const itemChunks: number[][] = [];
  for (let index = 0; index < uniqueAppIds.length; index += TOKEN_PROXY_ITEM_BATCH_SIZE) {
    itemChunks.push(uniqueAppIds.slice(index, index + TOKEN_PROXY_ITEM_BATCH_SIZE));
  }

  const itemResponses = await Promise.all(
    itemChunks.map((chunk) => getSteamItemsByAppIds(access, chunk)),
  );

  const itemCatalog = new Map(
    itemResponses
      .flatMap((response: TokenProxySteamItemsResponse) => response.items)
      .map((item: TokenProxySteamItemsResponse["items"][number]) => [item.appId, item] as const),
  );
  const currentByAppId = new Map(
    visibleApps.map((app: TokenProxySteamFamilyLibraryResponse["apps"][number]) => [
      app.appId,
      {
        appId: app.appId,
        name: itemCatalog.get(app.appId)?.name ?? app.name ?? null,
        imageUrl: itemCatalog.get(app.appId)?.imageUrl ?? null,
        headerImageUrl: itemCatalog.get(app.appId)?.headerImageUrl ?? null,
        ownerSteamIds: app.ownerSteamIds,
      },
    ]),
  );
  const addedGameRows = [...currentByAppId.values()].filter(
    (item) => !previousByAppId.has(item.appId),
  );
  const removedGameRows = [...previousByAppId.values()].filter(
    (item) => !currentByAppId.has(item.appId),
  );

  const family = await familyRepository.upsertFamily({
    id: familyPayload.familyId,
    ownerConnectionId: access.connection.id,
    name: familyPayload.name ?? null,
    lastSyncedAt: syncedAt,
  });

  const members = await familyRepository.replaceFamilyMembers({
    familyId: family.id,
    items: familyPayload.members.map((member) => ({
      steamId: member.steamId,
      role: member.role ?? null,
      metadata: {
        personaName: member.personaName ?? null,
        avatarHash: member.avatarHash ?? null,
        avatarUrl: buildSteamAvatarUrl(member.avatarHash ?? null),
      },
      lastSyncedAt: syncedAt,
    })),
  });
  const memberProfiles = familyPayload.members.map((member) => ({
    steamId: member.steamId,
    role: member.role ?? null,
    personaName: member.personaName ?? null,
    avatarUrl: buildSteamAvatarUrl(member.avatarHash ?? null),
  }));
  const memberProfileBySteamId = new Map(memberProfiles.map((member) => [member.steamId, member]));
  const withGameOwners = <T extends { ownerSteamIds: string[] }>(game: T) => ({
    ...game,
    owners: game.ownerSteamIds.map(
      (steamId) =>
        memberProfileBySteamId.get(steamId) ?? {
          steamId,
          role: null,
          personaName: null,
          avatarUrl: null,
        },
    ),
  });
  const addedGames = addedGameRows.map(withGameOwners);
  const removedGames = removedGameRows.map(withGameOwners);

  await catalogRepository.upsertAppCatalogEntries({
    items: visibleApps.map((app) => {
      const catalogItem = itemCatalog.get(app.appId);
      return {
        appId: app.appId,
        name: catalogItem?.name ?? app.name ?? null,
        imageUrl: catalogItem?.imageUrl ?? null,
        headerImageUrl: catalogItem?.headerImageUrl ?? null,
        metadata: catalogItem?.metadata ?? {
          source: "tori-steam-family",
        },
        updatedAt: syncedAt,
      };
    }),
  });

  const familyLibrary = await familyRepository.replaceFamilyLibraryItems({
    familyId: family.id,
    items: visibleApps.map((app: TokenProxySteamFamilyLibraryResponse["apps"][number]) => {
      const catalogItem = itemCatalog.get(app.appId);
      return {
        appId: app.appId,
        ownerSteamIds: app.ownerSteamIds,
        acquiredAt: toDateFromUnixSeconds(app.acquiredAt ?? null),
        metadata: {
          source: "tori-steam-family",
          name: app.name ?? catalogItem?.name ?? null,
          imageUrl: catalogItem?.imageUrl ?? null,
          headerImageUrl: catalogItem?.headerImageUrl ?? null,
        },
        lastSyncedAt: syncedAt,
      };
    }),
  });

  if (addedGames.length > 0 || removedGames.length > 0) {
    const payload: SteamFamilyLibraryChangedPayload = {
      connectionId: access.connection.id,
      familyId: family.id,
      familyName: family.name ?? null,
      librarySize: familyLibrary.length,
      syncedAt: syncedAt.toISOString(),
      members: memberProfiles,
      addedGames,
      removedGames,
    };

    await ctx.sendEvent(
      createOutboxEventFromCtx(ctx, {
        type: "SteamFamilyLibraryChanged",
        subject: `steam-family:${family.id}`,
        payload,
      }),
    );
  }

  return {
    connection: access.connection,
    family,
    members,
    librarySize: familyLibrary.length,
    addedGames,
    removedGames,
    syncedAt,
  };
}

export async function getSteamFamilyInfo(ctx: ServiceContext, input: GetSteamFamilyInfoInput) {
  const familyRepository = getSteamFamilyRepository(ctx);
  const connection = await resolveOwnedConnection(ctx, input.connectionId, input.ownerUserId);
  if (connection.provider !== "steam") {
    throw new ParameterError("Only Steam family info is supported");
  }

  let family = await familyRepository.findFamilyByOwnerConnectionId(connection.id);
  if (!family) {
    const refreshed = await refreshSteamFamily(ctx, {
      connectionId: connection.id,
      ownerUserId: input.ownerUserId,
      triggerType: "lazy-query",
    });
    family = refreshed.family;
  }

  const [members, libraryItems] = await Promise.all([
    familyRepository.listFamilyMembersByFamilyId(family.id),
    familyRepository.listFamilyLibraryItemsByFamilyId(family.id),
  ]);

  return {
    connection,
    family,
    members,
    librarySize: libraryItems.length,
    lastSyncedAt: family.lastSyncedAt ?? connection.lastSyncedAt ?? null,
  };
}

export async function querySteamFamilyLibrary(
  ctx: ServiceContext,
  input: QuerySteamFamilyLibraryInput,
) {
  const catalogRepository = getSteamCatalogRepository(ctx);
  const familyRepository = getSteamFamilyRepository(ctx);
  const connection = await resolveOwnedConnection(ctx, input.connectionId, input.ownerUserId);
  if (connection.provider !== "steam") {
    throw new ParameterError("Only Steam family library query is supported");
  }

  let family = await familyRepository.findFamilyByOwnerConnectionId(connection.id);
  if (!family) {
    const refreshed = await refreshSteamFamily(ctx, {
      connectionId: connection.id,
      ownerUserId: input.ownerUserId,
      triggerType: "lazy-query",
    });
    family = refreshed.family;
  }

  const offset = Math.max(0, input.offset ?? 0);
  const limit = Math.min(Math.max(1, input.limit ?? 20), 100);
  const access = await resolveSteamFamilyAccess(ctx, connection.id, input.ownerUserId);
  const missingCatalogAppIds = await familyRepository.listMissingCatalogAppIdsByFamilyId(family.id);

  if (missingCatalogAppIds.length > 0) {
    const itemChunks: number[][] = [];
    for (let index = 0; index < missingCatalogAppIds.length; index += TOKEN_PROXY_ITEM_BATCH_SIZE) {
      itemChunks.push(missingCatalogAppIds.slice(index, index + TOKEN_PROXY_ITEM_BATCH_SIZE));
    }

    const itemResponses = await Promise.all(
      itemChunks.map((chunk) => getSteamItemsByAppIds(access, chunk)),
    );

    const updatedAt = new Date();
    await catalogRepository.upsertAppCatalogEntries({
      items: itemResponses.flatMap((response) =>
        response.items.map((item) => ({
          appId: item.appId,
          name: item.name ?? null,
          imageUrl: item.imageUrl ?? null,
          headerImageUrl: item.headerImageUrl ?? null,
          metadata: item.metadata ?? {
            source: "tori-steam-family",
          },
          updatedAt,
        })),
      ),
    });
  }

  const [totalCount, matchedCount, rows] = await Promise.all([
    familyRepository.countFamilyLibraryItemsByFamilyId(family.id),
    familyRepository.countFamilyLibraryMatchesByFamilyId(family.id, input.query ?? null),
    familyRepository.queryFamilyLibraryRows({
      familyId: family.id,
      query: input.query ?? null,
      limit,
      offset,
    }),
  ]);

  return {
    connection,
    family,
    totalCount,
    matchedCount,
    items: rows.map((row) => {
      const metadata = toJsonRecord(row.itemMetadata);
      return {
        appId: Number(row.appId),
        name: row.name ?? (typeof metadata?.name === "string" ? metadata.name : null),
        ownerSteamIds: row.ownerSteamIds,
        acquiredAt: row.acquiredAt ?? null,
        imageUrl: row.imageUrl ?? null,
        headerImageUrl: row.headerImageUrl ?? null,
      };
    }),
    syncedAt: family.lastSyncedAt ?? connection.lastSyncedAt ?? null,
  };
}
