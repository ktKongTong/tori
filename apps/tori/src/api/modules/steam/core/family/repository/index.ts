import { createRepositoryGetter } from "@/api/domain/infra/repository";
import { SteamFamilyPgRepository } from "./pg";
import type { ISteamFamilyRepository } from "./repository";
import { SteamFamilySqliteRepository } from "./sqlite";

export { SteamFamilyPgRepository } from "./pg";
export type {
  ISteamFamilyRepository,
  QueryFamilyLibraryRowsInput,
  ReplaceFamilyLibraryItemsInput,
  ReplaceFamilyMembersInput,
  SteamFamilyLibraryItemRow,
  SteamFamilyLibraryRow,
  SteamFamilyMemberRow,
  SteamFamilyRow,
  UpsertFamilyInput,
} from "./repository";
export { SteamFamilySqliteRepository } from "./sqlite";

export const getSteamFamilyRepository = createRepositoryGetter<ISteamFamilyRepository>({
  pg: SteamFamilyPgRepository,
  sqlite: SteamFamilySqliteRepository,
});
