import { createRepositoryGetter } from "@/api/domain/infra/repository";
import { SteamCatalogPgRepository } from "./pg";
import type { ISteamCatalogRepository } from "./repository";
import { SteamCatalogSqliteRepository } from "./sqlite";

export { SteamCatalogPgRepository } from "./pg";
export type {
  AppCatalogRow,
  ISteamCatalogRepository,
  UpsertAppCatalogEntriesInput,
} from "./repository";
export { SteamCatalogSqliteRepository } from "./sqlite";

export const getSteamCatalogRepository = createRepositoryGetter<ISteamCatalogRepository>({
  pg: SteamCatalogPgRepository,
  sqlite: SteamCatalogSqliteRepository,
});
