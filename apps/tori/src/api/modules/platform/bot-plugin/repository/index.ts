import { createRepositoryGetter } from "@/api/domain/infra/repository";
import { BotPluginPgRepository } from "./pg";
import type { IBotPluginRepository } from "./repository";
import { BotPluginSqliteRepository } from "./sqlite";

export { BotPluginPgRepository } from "./pg";
export type * from "./repository";
export { BotPluginSqliteRepository } from "./sqlite";

export const getBotPluginRepository = createRepositoryGetter<IBotPluginRepository>({
  pg: BotPluginPgRepository,
  sqlite: BotPluginSqliteRepository,
});
