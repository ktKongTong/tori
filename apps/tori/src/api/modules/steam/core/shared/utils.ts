import { ParameterError } from "@/api/domain/error";

export const TOKEN_PROXY_ITEM_BATCH_SIZE = 100;
export const WRITE_BATCH_SIZE = 500;

export function chunkArray<T>(items: T[], size: number): T[][] {
  const chunks: T[][] = [];
  for (let index = 0; index < items.length; index += size) {
    chunks.push(items.slice(index, index + size));
  }
  return chunks;
}

export function toJsonRecord(value: unknown): Record<string, unknown> | null {
  if (!value || typeof value !== "object" || Array.isArray(value)) return null;
  return value as Record<string, unknown>;
}

export function buildSteamAppIconUrl(appId: number, iconHash?: string | null) {
  if (!iconHash) return null;
  return `https://media.steampowered.com/steamcommunity/public/images/apps/${appId}/${iconHash}.jpg`;
}

export function buildSteamAppHeaderUrl(appId: number) {
  return `https://cdn.cloudflare.steamstatic.com/steam/apps/${appId}/header.jpg`;
}

export function buildSteamAvatarUrl(avatarHash?: string | null) {
  if (!avatarHash) return null;
  return `https://avatars.steamstatic.com/${avatarHash}_full.jpg`;
}

export function resolveSteamIdFromConnectionId(providerAccountId: string) {
  return /^\d{17}$/.test(providerAccountId.trim()) ? providerAccountId.trim() : null;
}

function readXmlTag(xml: string, tag: string): string | null {
  const cdataMatch = xml.match(new RegExp(`<${tag}><!\\[CDATA\\[(.*?)\\]\\]><\\/${tag}>`, "s"));
  if (cdataMatch) return cdataMatch[1].trim();

  const plainMatch = xml.match(new RegExp(`<${tag}>(.*?)<\\/${tag}>`, "s"));
  if (plainMatch) return plainMatch[1].trim();

  return null;
}

export function parseSteamProfileXml(xml: string) {
  const steamId = readXmlTag(xml, "steamID64");
  if (!steamId) {
    throw new ParameterError("Steam profile response did not include steamID64");
  }

  const customUrl = readXmlTag(xml, "customURL");
  return {
    steamId,
    personaName: readXmlTag(xml, "steamID"),
    avatarUrl:
      readXmlTag(xml, "avatarFull") ??
      readXmlTag(xml, "avatarMedium") ??
      readXmlTag(xml, "avatarIcon"),
    profileUrl: customUrl
      ? `https://steamcommunity.com/id/${customUrl}`
      : `https://steamcommunity.com/profiles/${steamId}`,
    metadata: {
      onlineState: readXmlTag(xml, "onlineState"),
      stateMessage: readXmlTag(xml, "stateMessage"),
      privacyState: readXmlTag(xml, "privacyState"),
      visibilityState: readXmlTag(xml, "visibilityState"),
      customUrl,
      memberSince: readXmlTag(xml, "memberSince"),
      location: readXmlTag(xml, "location"),
      realName: readXmlTag(xml, "realname"),
      summary: readXmlTag(xml, "summary"),
    },
  };
}

export function buildSteamProfileFetchUrl(providerAccountId: string): string {
  const trimmed = providerAccountId.trim();
  const path = /^\d{17}$/.test(trimmed)
    ? `profiles/${encodeURIComponent(trimmed)}`
    : `id/${encodeURIComponent(trimmed)}`;
  return `https://steamcommunity.com/${path}/?xml=1`;
}

export function toDateFromUnixSeconds(value?: number | null): Date | null {
  if (!value) return null;
  return new Date(value * 1000);
}
