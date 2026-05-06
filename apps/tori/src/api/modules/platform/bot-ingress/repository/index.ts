import { createRepositoryGetter } from "@/api/domain/infra/repository";
import { BotIngressPgRepository } from "./pg";
import type { IBotIngressRepository } from "./repository";
import { BotIngressSqliteRepository } from "./sqlite";

export { BotIngressPgRepository } from "./pg";
export type * from "./repository";
export { BotIngressSqliteRepository } from "./sqlite";

export const getBotIngressRepository = createRepositoryGetter<IBotIngressRepository>({
  pg: BotIngressPgRepository,
  sqlite: BotIngressSqliteRepository,
});
