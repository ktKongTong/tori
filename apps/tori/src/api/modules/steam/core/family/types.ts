export interface GetSteamFamilyInfoInput {
  connectionId: string;
  ownerUserId?: string;
}

export interface QuerySteamFamilyLibraryInput {
  connectionId: string;
  ownerUserId?: string;
  query?: string | null;
  limit?: number;
  offset?: number;
}

export interface RefreshSteamFamilyInput {
  connectionId: string;
  ownerUserId?: string;
  triggerType: string;
}

export interface SteamFamilyLibraryChangedPayload {
  connectionId: string;
  familyId: string;
  familyName?: string | null;
  librarySize: number;
  syncedAt: string;
  addedGames: Array<{
    appId: number;
    name?: string | null;
    imageUrl?: string | null;
    headerImageUrl?: string | null;
  }>;
  removedGames: Array<{
    appId: number;
    name?: string | null;
    imageUrl?: string | null;
    headerImageUrl?: string | null;
  }>;
}

export type TokenProxySteamFamilyResponse = {
  familyId: string;
  name?: string | null;
  members: Array<{
    steamId: string;
    role?: string | null;
    personaName?: string | null;
    avatarHash?: string | null;
  }>;
};

export type TokenProxySteamFamilyLibraryResponse = {
  familyId: string;
  apps: Array<{
    appId: number;
    name?: string | null;
    ownerSteamIds: string[];
    acquiredAt?: number | null;
    excludeReason?: number | null;
  }>;
};

export type TokenProxySteamItemsResponse = {
  items: Array<{
    appId: number;
    name?: string | null;
    imageUrl?: string | null;
    headerImageUrl?: string | null;
    metadata?: Record<string, unknown> | null;
  }>;
};
