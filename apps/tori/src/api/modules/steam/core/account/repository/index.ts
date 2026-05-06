import { createRepositoryGetter } from "@/api/domain/infra/repository";
import { SteamAccountPgRepository } from "./pg";
import type { ISteamAccountRepository } from "./repository";
import { SteamAccountSqliteRepository } from "./sqlite";

export { SteamAccountPgRepository } from "./pg";
export type {
  AccountProfileRow,
  ISteamAccountRepository,
  ReplaceUserLibraryItemsInput,
  UpsertAccountProfileInput,
  UserLibraryItemRow,
} from "./repository";
export { SteamAccountSqliteRepository } from "./sqlite";

export const getSteamAccountRepository = createRepositoryGetter<ISteamAccountRepository>({
  pg: SteamAccountPgRepository,
  sqlite: SteamAccountSqliteRepository,
});
