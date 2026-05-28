import { ofetch } from "ofetch";
import { ParameterError } from "@/api/domain/error";
import type { ServiceContext } from "@/api/domain/infra/service-context";
import { getSteamAccountRepository } from "@/api/modules/steam/core/account/repository";
import type {
  FetchSteamPublicProfileInput,
  QuerySteamUserLibraryInput,
  SteamOwnedGamesResponse,
} from "@/api/modules/steam/core/account/types";
import { getSteamCatalogRepository } from "@/api/modules/steam/core/catalog/repository";
import { resolveOwnedConnection } from "@/api/modules/steam/core/connection/access";
import {
  buildSteamAppHeaderUrl,
  buildSteamAppIconUrl,
  buildSteamProfileFetchUrl,
  parseSteamProfileXml,
  resolveSteamIdFromConnectionId,
  toDateFromUnixSeconds,
} from "@/api/modules/steam/core/shared/utils";

type SteamOwnedGame = NonNullable<
  NonNullable<SteamOwnedGamesResponse["response"]>["games"]
>[number];

export async function fetchSteamPublicProfile(
  ctx: ServiceContext,
  input: FetchSteamPublicProfileInput,
) {
  const accountRepository = getSteamAccountRepository(ctx);
  const connection = await resolveOwnedConnection(ctx, input.connectionId, input.ownerUserId);
  if (connection.provider !== "steam") {
    throw new ParameterError("Only Steam public profile fetching is supported");
  }

  const xml = await ofetch(buildSteamProfileFetchUrl(connection.providerAccountId), {
    responseType: "text",
    retry: 0,
    timeout: 10000,
    headers: {
      "user-agent": "steam-bot-backend/0.1",
    },
  });

  const parsed = parseSteamProfileXml(xml);
  const accountProfile = await accountRepository.upsertAccountProfile({
    steamId: parsed.steamId,
    connectionId: connection.id,
    personaName: parsed.personaName,
    avatarUrl: parsed.avatarUrl,
    profileUrl: parsed.profileUrl,
    metadata: parsed.metadata,
    lastSyncedAt: new Date(),
  });

  return { connection, accountProfile, fetchedFromNetwork: true };
}

export async function querySteamUserLibrary(
  ctx: ServiceContext,
  input: QuerySteamUserLibraryInput,
) {
  const accountRepository = getSteamAccountRepository(ctx);
  const catalogRepository = getSteamCatalogRepository(ctx);
  const connection = await resolveOwnedConnection(ctx, input.connectionId, input.ownerUserId);
  if (connection.provider !== "steam") {
    throw new ParameterError("Only Steam user library query is supported");
  }
  if (connection.accessMode !== "proxy-token") {
    throw new ParameterError("Connection does not support public Steam library access");
  }

  const steamWebApiKey = ctx.env.STEAM_WEB_API_KEY?.trim();
  if (!steamWebApiKey) {
    throw new ParameterError("STEAM_WEB_API_KEY is required for Steam user library query");
  }

  let steamId = resolveSteamIdFromConnectionId(connection.providerAccountId);
  if (!steamId) {
    const cachedProfile = await accountRepository.findAccountProfileByConnectionId(connection.id);
    steamId = cachedProfile?.steamId ?? null;
  }
  if (!steamId) {
    const profile = await fetchSteamPublicProfile(ctx, {
      connectionId: connection.id,
      ownerUserId: input.ownerUserId,
    });
    steamId = profile.accountProfile.steamId;
  }

  const syncedAt = new Date();
  const ownedGames = await ofetch<SteamOwnedGamesResponse>(
    "https://api.steampowered.com/IPlayerService/GetOwnedGames/v1/",
    {
      query: {
        key: steamWebApiKey,
        steamid: steamId,
        include_appinfo: 1,
        include_played_free_games: 1,
        format: "json",
      },
      retry: 0,
      timeout: 20000,
      headers: {
        "user-agent": "steam-bot-backend/0.1",
      },
    },
  );

  const games: SteamOwnedGame[] = ownedGames.response?.games ?? [];

  await catalogRepository.upsertAppCatalogEntries({
    items: games.map((game: SteamOwnedGame) => ({
      appId: game.appid,
      name: game.name ?? null,
      imageUrl: buildSteamAppIconUrl(game.appid, game.img_icon_url ?? null),
      headerImageUrl: buildSteamAppHeaderUrl(game.appid),
      metadata: {
        source: "steam-owned-games",
        imgLogoUrl: game.img_logo_url ?? null,
      },
      updatedAt: syncedAt,
    })),
  });

  await accountRepository.replaceUserLibraryItems({
    steamId,
    items: games.map((game: SteamOwnedGame) => ({
      appId: game.appid,
      playtimeMinutes: game.playtime_forever ?? null,
      lastPlayedAt: toDateFromUnixSeconds(game.rtime_last_played),
      metadata: {
        source: "steam-owned-games",
      },
      lastSyncedAt: syncedAt,
    })),
  });

  const normalizedQuery = input.query?.trim().toLowerCase() ?? "";
  const mappedItems = games
    .map((game: SteamOwnedGame) => ({
      appId: game.appid,
      name: game.name ?? null,
      playtimeMinutes: game.playtime_forever ?? null,
      lastPlayedAt: toDateFromUnixSeconds(game.rtime_last_played),
      imageUrl: buildSteamAppIconUrl(game.appid, game.img_icon_url ?? null),
      headerImageUrl: buildSteamAppHeaderUrl(game.appid),
    }))
    .filter((item: { name: string | null; appId: number }) => {
      if (!normalizedQuery) return true;
      const haystacks = [item.name?.toLowerCase() ?? "", String(item.appId)];
      return haystacks.some((value) => value.includes(normalizedQuery));
    })
    .sort(
      (
        left: { lastPlayedAt: Date | null; playtimeMinutes: number | null },
        right: { lastPlayedAt: Date | null; playtimeMinutes: number | null },
      ) => {
        const leftScore = left.lastPlayedAt?.getTime() ?? 0;
        const rightScore = right.lastPlayedAt?.getTime() ?? 0;
        if (rightScore !== leftScore) return rightScore - leftScore;
        return (right.playtimeMinutes ?? 0) - (left.playtimeMinutes ?? 0);
      },
    );

  return {
    connection,
    steamId,
    totalCount: games.length,
    matchedCount: mappedItems.length,
    items: mappedItems.slice(0, input.limit ?? 20),
    syncedAt,
  };
}

export async function getSteamConnectionAccountProfile(ctx: ServiceContext, connectionId: string) {
  return fetchSteamPublicProfile(ctx, {
    connectionId,
    ownerUserId: ctx.userId ?? undefined,
  });
}
