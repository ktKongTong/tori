import { desc } from "drizzle-orm";
import { accountProfiles } from "@/api/modules/steam/core/schema/pg";
import {
  botPluginInstances,
  channelBindings,
  channels,
  claimSessions,
  connections,
  deliveryEndpoints,
  notificationEvents,
  proxyInstances,
  subscriptions,
  taskDefinitions,
  user,
  userBindings,
} from "@/api/db/schema/pg";
import type { PGDB } from "@/api/domain/infra/db";
import type { IDashboardRepository } from "./repository";

export class DashboardPgRepository implements IDashboardRepository {
  constructor(private readonly db: PGDB) {}

  async listBindingRows() {
    const db = this.db;
    const [users, channelsList, claims, userRows, channelRows, botInstances] = await Promise.all([
      db.select().from(userBindings).orderBy(desc(userBindings.createdAt)).limit(100),
      db.select().from(channelBindings).orderBy(desc(channelBindings.createdAt)).limit(100),
      db.select().from(claimSessions).orderBy(desc(claimSessions.createdAt)).limit(100),
      db.select().from(user).limit(200),
      db.select().from(channels).limit(200),
      db.select().from(botPluginInstances).limit(200),
    ]);

    return { users, channelsList, claims, userRows, channelRows, botInstances };
  }

  async listIntegrationRows() {
    const db = this.db;
    const [proxies, conns, accountProfileRows] = await Promise.all([
      db.select().from(proxyInstances).orderBy(desc(proxyInstances.createdAt)).limit(100),
      db.select().from(connections).orderBy(desc(connections.createdAt)).limit(100),
      db.select().from(accountProfiles).orderBy(desc(accountProfiles.updatedAt)).limit(100),
    ]);
    const profiles = accountProfileRows.map((row) => ({
      connectionId: row.connectionId,
      externalAccountId: row.steamId,
      displayName: row.personaName,
      avatarUrl: row.avatarUrl,
      profileUrl: row.profileUrl,
      lastSyncedAt: row.lastSyncedAt,
    }));

    return { proxies, conns, profiles };
  }

  async listBotInstanceRows() {
    const db = this.db;
    const [instances, endpoints] = await Promise.all([
      db.select().from(botPluginInstances).orderBy(desc(botPluginInstances.updatedAt)).limit(100),
      db.select().from(deliveryEndpoints).orderBy(desc(deliveryEndpoints.updatedAt)).limit(100),
    ]);

    return { instances, endpoints };
  }

  async listNotifyRows() {
    const db = this.db;
    const [webhooks, subs, notifications, channelRows, connectionRows, userRows, botInstances] =
      await Promise.all([
        db.select().from(deliveryEndpoints).orderBy(desc(deliveryEndpoints.createdAt)).limit(100),
        db.select().from(subscriptions).orderBy(desc(subscriptions.createdAt)).limit(100),
        db.select().from(notificationEvents).orderBy(desc(notificationEvents.createdAt)).limit(100),
        db.select().from(channels).limit(200),
        db.select().from(connections).limit(200),
        db.select().from(user).limit(200),
        db.select().from(botPluginInstances).limit(200),
      ]);

    return {
      webhooks,
      subs,
      notifications,
      channelRows,
      connectionRows,
      userRows,
      botInstances,
    };
  }

  async listTaskRows() {
    const db = this.db;
    const [tasks, connectionRows] = await Promise.all([
      db.select().from(taskDefinitions).orderBy(desc(taskDefinitions.createdAt)).limit(100),
      db.select().from(connections).limit(200),
    ]);

    return { tasks, connectionRows };
  }
}
