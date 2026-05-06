import { createRepositoryGetter } from "@/api/domain/infra/repository";
import { DashboardPgRepository } from "./pg";
import type { IDashboardRepository } from "./repository";
import { DashboardSqliteRepository } from "./sqlite";

export { DashboardPgRepository } from "./pg";
export type { IDashboardRepository } from "./repository";
export { DashboardSqliteRepository } from "./sqlite";

export const getDashboardRepository = createRepositoryGetter<IDashboardRepository>({
  pg: DashboardPgRepository,
  sqlite: DashboardSqliteRepository,
});
