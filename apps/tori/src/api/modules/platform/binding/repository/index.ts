import { createRepositoryGetter } from "@/api/domain/infra/repository";
import { BindingPgRepository } from "./pg";
import type { IBindingRepository } from "./repository";
import { BindingSqliteRepository } from "./sqlite";

export { BindingPgRepository } from "./pg";
export type * from "./repository";
export { BindingSqliteRepository } from "./sqlite";

export const getBindingRepository = createRepositoryGetter<IBindingRepository>({
  pg: BindingPgRepository,
  sqlite: BindingSqliteRepository,
});
