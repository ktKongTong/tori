import type { DB, DBType, PGDB, SqliteDB } from "../domain/infra/db";
import type { PlatformRepositoryContainer } from "../domain/platform/repository/container";
import { ConnectionPgRepository, ConnectionSqliteRepository } from "./connection";
import { InboxPgRepository, InboxSqliteRepository } from "./inbox";
import { IntegrationPgRepository, IntegrationSqliteRepository } from "./integration";
import { NotifyPgRepository, NotifySqliteRepository } from "./notify";
import { OutboxPgRepository, OutboxSqliteRepository } from "./outbox";
import { SubscriptionPgRepository, SubscriptionSqliteRepository } from "./subscription";
import { TaskPgRepository, TaskSqliteRepository } from "./task";
import {
  BindingPgRepository,
  BindingSqliteRepository,
} from "@/api/modules/platform/binding/repository";

export function createRepositoryContainer<T extends DBType>(
  tx: DB<T>,
  dbType: T,
): PlatformRepositoryContainer {
  if (dbType === "sqlite") {
    return createSqliteRepositoryContainer(tx as SqliteDB);
  }

  return createPgRepositoryContainer(tx as PGDB);
}

function createPgRepositoryContainer(tx: PGDB): PlatformRepositoryContainer {
  return {
    outbox: new OutboxPgRepository(tx),
    inbox: new InboxPgRepository(tx),
    integration: new IntegrationPgRepository(tx),
    binding: new BindingPgRepository(tx),
    notify: new NotifyPgRepository(tx),
    task: new TaskPgRepository(tx),
    subscription: new SubscriptionPgRepository(tx),
    connection: new ConnectionPgRepository(tx),
  };
}

function createSqliteRepositoryContainer(tx: SqliteDB): PlatformRepositoryContainer {
  return {
    outbox: new OutboxSqliteRepository(tx),
    inbox: new InboxSqliteRepository(tx),
    integration: new IntegrationSqliteRepository(tx),
    binding: new BindingSqliteRepository(tx),
    notify: new NotifySqliteRepository(tx),
    task: new TaskSqliteRepository(tx),
    subscription: new SubscriptionSqliteRepository(tx),
    connection: new ConnectionSqliteRepository(tx),
  };
}
