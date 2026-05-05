import { createRequire } from "node:module";
import { Hono } from "hono";
import { decrypt, encrypt } from "../crypto/index.ts";
import { SteamProvider } from "../provider/steam.ts";
import type { Repository } from "../repository/types.ts";
import type { Connection } from "../types.ts";

const require = createRequire(import.meta.url);
const { SteamAPI } = require("node-steam-family-group-api") as {
  SteamAPI: new (accessToken?: string) => any;
};

interface SteamFamilyDeps {
  repo: Repository;
  secret: string;
}

function assetUrlFromFormat(format?: string | null, filename?: string | null) {
  if (!format || !filename) return null;
  return `https://cdn.akamai.steamstatic.com/${format.replace("${FILENAME}", filename)}`;
}

async function loadSteamCredentials(repo: Repository, secret: string, connectionId: string) {
  const creds = await repo.getCredentials(connectionId);
  if (!creds) {
    throw new Error("credentials not found");
  }

  return {
    accessToken: await decrypt(creds.accessToken, secret),
    refreshToken: creds.refreshToken ? await decrypt(creds.refreshToken, secret) : "",
  };
}

async function refreshSteamAccessToken(
  repo: Repository,
  secret: string,
  connectionId: string,
  refreshToken: string,
) {
  const provider = new SteamProvider();
  const refreshed = await provider.refreshToken(refreshToken);
  const nextRefreshToken = refreshed.refreshToken ?? refreshToken;

  await repo.updateCredentials(connectionId, {
    accessToken: await encrypt(refreshed.accessToken, secret),
    refreshToken: await encrypt(nextRefreshToken, secret),
  });

  return refreshed.accessToken;
}

async function withSteamAccessRetry<T extends { ok?: boolean; message?: string }>(
  repo: Repository,
  secret: string,
  connectionId: string,
  run: (accessToken: string) => Promise<T>,
) {
  const creds = await loadSteamCredentials(repo, secret, connectionId);
  let result = await run(creds.accessToken);

  if (result?.ok || !creds.refreshToken) {
    return result;
  }

  const refreshedAccessToken = await refreshSteamAccessToken(
    repo,
    secret,
    connectionId,
    creds.refreshToken,
  );

  result = await run(refreshedAccessToken);
  return result;
}

export function steamFamilyRoutes(deps: SteamFamilyDeps) {
  const { repo, secret } = deps;
  const app = new Hono();

  app.get("/family", async (c) => {
    const conn = c.get("connection") as Connection;
    const family = await withSteamAccessRetry(repo, secret, conn.id, async (accessToken) => {
      const steamApi = new SteamAPI(accessToken);
      return steamApi.familyGroup.getFamilyGroupForUser(
        {
          steamid: BigInt(conn.providerUid),
          includeFamilyGroupResponse: true,
        },
        accessToken,
      );
    });

    if (!family?.ok || !family.data?.familyGroupid || !family.data.familyGroup) {
      return c.json(
        {
          error: "upstream_error",
          error_description: family?.message || "failed to fetch steam family group",
        },
        502,
      );
    }

    const playerDetails = await withSteamAccessRetry(repo, secret, conn.id, async (accessToken) => {
      const steamApi = new SteamAPI(accessToken);
      const steamIds = family.data.familyGroup.members.map((member: any) =>
        member.steamid?.toString(),
      );
      return steamIds.length
        ? await steamApi.common.getSteamPlayerLinkDetails(
            { steamids: steamIds.map((steamId: string) => BigInt(steamId)) },
            accessToken,
          )
        : ({ data: { accounts: [] } } as any);
    });

    const publicDataBySteamId = new Map<string | undefined, any>(
      (playerDetails.data?.accounts ?? []).map((account: any) => [
        account.publicData?.steamid?.toString(),
        account.publicData,
      ]),
    );

    return c.json({
      familyId: family.data.familyGroupid.toString(),
      name: family.data.familyGroup.name ?? null,
      members: family.data.familyGroup.members.map((member: any) => {
        const publicData = publicDataBySteamId.get(member.steamid?.toString());
        return {
          steamId: member.steamid?.toString() ?? "",
          role: member.role != null ? String(member.role) : null,
          personaName: publicData?.personaName ?? null,
          avatarHash: publicData?.shaDigestAvatarHash
            ? String(publicData.shaDigestAvatarHash)
            : null,
        };
      }),
    });
  });

  app.get("/family/shared/:familyId", async (c) => {
    const conn = c.get("connection") as Connection;
    const familyId = c.req.param("familyId");

    const sharedLibrary = await withSteamAccessRetry(repo, secret, conn.id, async (accessToken) => {
      const steamApi = new SteamAPI(accessToken);
      return steamApi.familyGroup.getFamilyGroupShardLibrary(
        {
          familyGroupid: BigInt(familyId),
          includeOwn: true,
          includeExcluded: true,
          language: "schinese",
        },
        accessToken,
      );
    });

    if (!sharedLibrary?.ok || !sharedLibrary.data) {
      return c.json(
        {
          error: "upstream_error",
          error_description: sharedLibrary?.message || "failed to fetch shared family library",
        },
        502,
      );
    }

    return c.json({
      familyId,
      apps: (sharedLibrary.data.apps ?? []).map((appItem: any) => ({
        appId: Number(appItem.appid),
        name: appItem.name ?? null,
        ownerSteamIds: (appItem.ownerSteamids ?? []).map((steamId: any) => steamId.toString()),
        acquiredAt: appItem.rtTimeAcquired ? Number(appItem.rtTimeAcquired) : null,
        excludeReason: appItem.excludeReason == null ? null : Number(appItem.excludeReason),
      })),
    });
  });

  app.get("/items/:appIds", async (c) => {
    const appIds = c.req
      .param("appIds")
      .split(",")
      .map((value) => Number.parseInt(value, 10))
      .filter((value) => Number.isFinite(value));

    if (appIds.length === 0) {
      return c.json({ items: [] });
    }

    const steamApi = new SteamAPI();
    const items = await steamApi.common.getSteamItemsById({
      ids: appIds.map((appId) => ({ appid: appId })),
      context: {
        language: "schinese",
        countryCode: "US",
        steamRealm: 1,
      },
      dataRequest: {
        includeAssets: true,
        includeRelease: true,
        includeTagCount: 20,
      },
    });

    if (!items.ok || !items.data) {
      return c.json(
        {
          error: "upstream_error",
          error_description: items.message || "failed to fetch steam items",
        },
        502,
      );
    }

    return c.json({
      items: (items.data.storeItems ?? []).map((item: any) => ({
        appId: Number(item.appid),
        name: item.name ?? null,
        imageUrl: assetUrlFromFormat(
          item.assets?.assetUrlFormat,
          item.assets?.libraryCapsule ?? item.assets?.mainCapsule,
        ),
        headerImageUrl: assetUrlFromFormat(item.assets?.assetUrlFormat, item.assets?.header),
        metadata: {
          basicInfo: item.basicInfo ?? null,
          tags: item.tags ?? [],
          assets: item.assets ?? null,
        },
      })),
    });
  });

  return app;
}
