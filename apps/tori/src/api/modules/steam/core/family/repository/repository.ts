/* oxlint-disable typescript-eslint/no-redundant-type-constituents */

export type SteamFamilyRepositoryJson = unknown;

export interface SteamFamilyRow {
  id: string;
  ownerConnectionId: string;
  name: string | null;
  metadata: SteamFamilyRepositoryJson | null;
  lastSyncedAt: Date | null;
  createdAt: Date;
  updatedAt: Date;
}

export interface SteamFamilyMemberRow {
  familyId: string;
  steamId: string;
  role: string | null;
  metadata: SteamFamilyRepositoryJson | null;
  joinedAt: Date | null;
  lastSyncedAt: Date | null;
  leftAt: Date | null;
  createdAt: Date;
  updatedAt: Date;
}

export interface SteamFamilyLibraryItemRow {
  familyId: string;
  appId: number;
  ownerSteamIds: string[];
  acquiredAt: Date | null;
  metadata: SteamFamilyRepositoryJson | null;
  lastSyncedAt: Date | null;
  createdAt: Date;
  updatedAt: Date;
}

export type UpsertFamilyInput = {
  id: string;
  ownerConnectionId: string;
  name?: string | null;
  metadata?: SteamFamilyRepositoryJson | null;
  lastSyncedAt: Date;
};

export type ReplaceFamilyMembersInput = {
  familyId: string;
  items: Array<{
    steamId: string;
    role?: string | null;
    metadata?: SteamFamilyRepositoryJson | null;
    lastSyncedAt: Date;
  }>;
};

export type ReplaceFamilyLibraryItemsInput = {
  familyId: string;
  items: Array<{
    appId: number;
    ownerSteamIds: string[];
    acquiredAt?: Date | null;
    metadata?: SteamFamilyRepositoryJson | null;
    lastSyncedAt: Date;
  }>;
};

export type QueryFamilyLibraryRowsInput = {
  familyId: string;
  query?: string | null;
  limit: number;
  offset: number;
};

export type SteamFamilyLibraryRow = {
  appId: number;
  ownerSteamIds: string[];
  acquiredAt: Date | null;
  itemMetadata: SteamFamilyRepositoryJson;
  name: string | null;
  imageUrl: string | null;
  headerImageUrl: string | null;
};

export interface ISteamFamilyRepository {
  upsertFamily(input: UpsertFamilyInput): Promise<SteamFamilyRow>;
  replaceFamilyMembers(input: ReplaceFamilyMembersInput): Promise<SteamFamilyMemberRow[]>;
  replaceFamilyLibraryItems(
    input: ReplaceFamilyLibraryItemsInput,
  ): Promise<SteamFamilyLibraryItemRow[]>;
  findFamilyByOwnerConnectionId(connectionId: string): Promise<SteamFamilyRow | null>;
  listFamilyMembersByFamilyId(familyId: string): Promise<SteamFamilyMemberRow[]>;
  listFamilyLibraryItemsByFamilyId(familyId: string): Promise<SteamFamilyLibraryItemRow[]>;
  listMissingCatalogAppIdsByFamilyId(familyId: string): Promise<number[]>;
  countFamilyLibraryItemsByFamilyId(familyId: string): Promise<number>;
  countFamilyLibraryMatchesByFamilyId(familyId: string, query?: string | null): Promise<number>;
  queryFamilyLibraryRows(input: QueryFamilyLibraryRowsInput): Promise<SteamFamilyLibraryRow[]>;
}
