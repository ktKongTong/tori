import type { DB, DBType, PGDB, SqliteDB } from "../domain/infra/db";
import type { PlatformRepositoryContainer } from "../domain/platform/repository/container";
import {
  InboxPgRepository,
  InboxSqliteRepository,
} from "@/api/domain/infra/eventing/repository/inbox";
import {
  OutboxPgRepository,
  OutboxSqliteRepository,
} from "@/api/domain/infra/eventing/repository/outbox";
import {
  BindingPgRepository,
  BindingSqliteRepository,
} from "@/api/modules/platform/binding/repository";
import {
  ConnectionPgRepository,
  ConnectionSqliteRepository,
} from "@/api/modules/platform/integration/connection/repository";
import {
  IntegrationPgRepository,
  IntegrationSqliteRepository,
} from "@/api/modules/platform/integration/proxy-instance/repository";
import {
  NotifyPgRepository,
  NotifySqliteRepository,
} from "@/api/modules/platform/notification/notification/repository";
import {
  SubscriptionPgRepository,
  SubscriptionSqliteRepository,
} from "@/api/modules/platform/notification/subscription/repository";
import { TaskPgRepository, TaskSqliteRepository } from "@/api/modules/platform/task/repository";

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
