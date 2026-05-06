/* oxlint-disable typescript-eslint/no-redundant-type-constituents */

export type SteamCatalogRepositoryJson = unknown;

export interface AppCatalogRow {
  appId: number;
  name: string | null;
  imageUrl: string | null;
  headerImageUrl: string | null;
  metadata: SteamCatalogRepositoryJson | null;
  updatedAt: Date;
}

export type UpsertAppCatalogEntriesInput = {
  items: Array<{
    appId: number;
    name?: string | null;
    imageUrl?: string | null;
    headerImageUrl?: string | null;
    metadata?: SteamCatalogRepositoryJson | null;
    updatedAt: Date;
  }>;
};

export interface ISteamCatalogRepository {
  upsertAppCatalogEntries(input: UpsertAppCatalogEntriesInput): Promise<AppCatalogRow[]>;
}
