import type { PGDB, SqliteDB } from "./db";
import type { ServiceContext } from "./service-context";
import type { IInboxRepository, IOutboxRepository } from "./eventing/repo.ts";
import type { ITaskRepository } from "./repository/ports/task.ts";

export type InfraRepositoryContainer = {
  outbox: IOutboxRepository;
  inbox: IInboxRepository;
  task: ITaskRepository;
};

export type RepositoryFactory<TRepository> = {
  pg: (tx: PGDB) => TRepository;
  sqlite: (tx: SqliteDB) => TRepository;
};

export type RepositoryConstructor<TDb, TRepository> = new (db: TDb) => TRepository;

export function createRepositoryGetter<TRepository>(constructors: {
  pg: RepositoryConstructor<PGDB, TRepository>;
  sqlite: RepositoryConstructor<SqliteDB, unknown>;
}) {
  return (ctx: ServiceContext): TRepository =>
    ctx.createRepository({
      pg: (tx) => new constructors.pg(tx),
      sqlite: (tx) => new constructors.sqlite(tx) as TRepository,
    });
}
