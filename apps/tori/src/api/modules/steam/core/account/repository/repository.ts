/* oxlint-disable typescript-eslint/no-redundant-type-constituents */

export type SteamAccountRepositoryJson = unknown;

export interface AccountProfileRow {
  steamId: string;
  connectionId: string;
  personaName: string | null;
  avatarUrl: string | null;
  profileUrl: string | null;
  metadata: SteamAccountRepositoryJson | null;
  lastSyncedAt: Date | null;
  createdAt: Date;
  updatedAt: Date;
}

export interface UserLibraryItemRow {
  steamId: string;
  appId: number;
  playtimeMinutes: number | null;
  lastPlayedAt: Date | null;
  metadata: SteamAccountRepositoryJson | null;
  lastSyncedAt: Date | null;
  createdAt: Date;
  updatedAt: Date;
}

export type UpsertAccountProfileInput = {
  steamId: string;
  connectionId: string;
  personaName?: string | null;
  avatarUrl?: string | null;
  profileUrl?: string | null;
  metadata?: SteamAccountRepositoryJson | null;
  lastSyncedAt: Date;
};

export type ReplaceUserLibraryItemsInput = {
  steamId: string;
  items: Array<{
    appId: number;
    playtimeMinutes?: number | null;
    lastPlayedAt?: Date | null;
    metadata?: SteamAccountRepositoryJson | null;
    lastSyncedAt: Date;
  }>;
};

export interface ISteamAccountRepository {
  upsertAccountProfile(input: UpsertAccountProfileInput): Promise<AccountProfileRow>;
  replaceUserLibraryItems(input: ReplaceUserLibraryItemsInput): Promise<UserLibraryItemRow[]>;
  findAccountProfileByConnectionId(connectionId: string): Promise<AccountProfileRow | null>;
}
