import {
  CFamilyGroups_GetFamilyGroupForUser_Request,
  CFamilyGroups_GetFamilyGroupForUser_Response,
  CFamilyGroups_GetSharedLibraryApps_Request,
  CFamilyGroups_GetSharedLibraryApps_Response,
  CPlayer_GetPlayerLinkDetails_Request,
  CPlayer_GetPlayerLinkDetails_Response,
  CStoreBrowse_GetItems_Request,
  CStoreBrowse_GetItems_Response,
  StoreBrowseContext,
  StoreBrowseItemDataRequest,
  StoreItemID,
  encodeProtobuf,
  shaDigestAvatarToStrAvatarHash,
} from "node-steam-family-group-api";
import { ParameterError } from "@/api/domain/error";
import type { SteamFamilyAccess } from "@/api/modules/steam/core/connection/access";
import type {
  TokenProxySteamFamilyLibraryResponse,
  TokenProxySteamFamilyResponse,
  TokenProxySteamItemsResponse,
} from "./types";

type ProtobufRequest = {
  toBinary(): Uint8Array;
};

type ProtobufResponseClass<T> = {
  fromBinary(bytes: Uint8Array): T;
};

function assetUrlFromFormat(format?: string | null, filename?: string | null) {
  if (!format || !filename) return null;
  return `https://cdn.akamai.steamstatic.com/${format.replace("${FILENAME}", filename)}`;
}

async function proxySteamWebApi<T>(input: {
  access: SteamFamilyAccess;
  serviceName: string;
  itemName: string;
  request: ProtobufRequest;
  responseClass: ProtobufResponseClass<T>;
}) {
  const targetUrl = new URL(
    `https://api.steampowered.com/${input.serviceName}/${input.itemName}/v1`,
  );
  targetUrl.searchParams.set("spoof_steamid", "");
  targetUrl.searchParams.set("origin", "https://store.steampowered.com");
  targetUrl.searchParams.set("input_protobuf_encoded", encodeProtobuf(input.request.toBinary()));

  const response = await fetch(`${input.access.proxyBaseUrl}/proxy/steam`, {
    method: "GET",
    headers: {
      "X-API-KEY": input.access.apiKey,
      "X-PROXY-URL": targetUrl.toString().replaceAll("%25", "%"),
      accept: "application/octet-stream",
      origin: "https://store.steampowered.com",
      referer: "https://store.steampowered.com/",
      "user-agent":
        "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/123.0.0.0 Safari/537.36",
    },
  });

  if (!response.ok) {
    const message = await response.text();
    throw new ParameterError(
      `Steam upstream request failed: ${response.status} ${response.statusText} ${message}`.trim(),
    );
  }

  return input.responseClass.fromBinary(new Uint8Array(await response.arrayBuffer()));
}

export async function getSteamFamilyForConnection(
  access: SteamFamilyAccess,
): Promise<TokenProxySteamFamilyResponse> {
  const family = await proxySteamWebApi<CFamilyGroups_GetFamilyGroupForUser_Response>({
    access,
    serviceName: "IFamilyGroupsService",
    itemName: "GetFamilyGroupForUser",
    request: new CFamilyGroups_GetFamilyGroupForUser_Request({
      steamid: BigInt(access.connection.providerAccountId),
      includeFamilyGroupResponse: true,
    }),
    responseClass: CFamilyGroups_GetFamilyGroupForUser_Response,
  });

  if (!family.familyGroupid || !family.familyGroup) {
    throw new ParameterError("Steam family group response is missing family data");
  }

  const steamIds = family.familyGroup.members
    .map((member) => member.steamid?.toString())
    .filter((steamId): steamId is string => Boolean(steamId));
  const playerDetails = steamIds.length
    ? await proxySteamWebApi<CPlayer_GetPlayerLinkDetails_Response>({
        access,
        serviceName: "IPlayerService",
        itemName: "GetPlayerLinkDetails",
        request: new CPlayer_GetPlayerLinkDetails_Request({
          steamids: steamIds.map((steamId) => BigInt(steamId)),
        }),
        responseClass: CPlayer_GetPlayerLinkDetails_Response,
      })
    : new CPlayer_GetPlayerLinkDetails_Response();
  const publicDataBySteamId = new Map(
    playerDetails.accounts.map((account) => [
      account.publicData?.steamid?.toString(),
      account.publicData,
    ]),
  );

  return {
    familyId: family.familyGroupid.toString(),
    name: family.familyGroup.name ?? null,
    members: family.familyGroup.members.map((member) => {
      const publicData = publicDataBySteamId.get(member.steamid?.toString());
      return {
        steamId: member.steamid?.toString() ?? "",
        role: member.role != null ? String(member.role) : null,
        personaName: publicData?.personaName ?? null,
        avatarHash: publicData?.shaDigestAvatar
          ? shaDigestAvatarToStrAvatarHash(publicData.shaDigestAvatar)
          : null,
      };
    }),
  };
}

export async function getSteamFamilySharedLibrary(
  access: SteamFamilyAccess,
  familyId: string,
): Promise<TokenProxySteamFamilyLibraryResponse> {
  const sharedLibrary = await proxySteamWebApi<CFamilyGroups_GetSharedLibraryApps_Response>({
    access,
    serviceName: "IFamilyGroupsService",
    itemName: "GetSharedLibraryApps",
    request: new CFamilyGroups_GetSharedLibraryApps_Request({
      familyGroupid: BigInt(familyId),
      includeOwn: true,
      includeExcluded: true,
      language: "schinese",
    }),
    responseClass: CFamilyGroups_GetSharedLibraryApps_Response,
  });

  return {
    familyId,
    apps: sharedLibrary.apps.map((app) => ({
      appId: Number(app.appid),
      name: app.name ?? null,
      ownerSteamIds: app.ownerSteamids.map((steamId) => steamId.toString()),
      acquiredAt: app.rtTimeAcquired ?? null,
      excludeReason: app.excludeReason == null ? null : Number(app.excludeReason),
    })),
  };
}

export async function getSteamItemsByAppIds(
  access: SteamFamilyAccess,
  appIds: number[],
): Promise<TokenProxySteamItemsResponse> {
  if (appIds.length === 0) return { items: [] };

  const response = await proxySteamWebApi<CStoreBrowse_GetItems_Response>({
    access,
    serviceName: "IStoreBrowseService",
    itemName: "GetItems",
    request: new CStoreBrowse_GetItems_Request({
      ids: appIds.map((appId) => new StoreItemID({ appid: appId })),
      context: new StoreBrowseContext({
        language: "schinese",
        countryCode: "US",
        steamRealm: 1,
      }),
      dataRequest: new StoreBrowseItemDataRequest({
        includeAssets: true,
        includeRelease: true,
        includeTagCount: 20,
      }),
    }),
    responseClass: CStoreBrowse_GetItems_Response,
  });

  return {
    items: response.storeItems.map((item) => ({
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
  };
}
