import { count, desc, eq } from "drizzle-orm";
import { accountProfiles } from "@/api/modules/steam/core/schema/d1";
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
  taskRuns,
  user,
  userBindings,
} from "@/api/db/schema/d1";
import type { SqliteDB } from "@/api/domain/infra/db";
import type { IDashboardRepository } from "./repository";

export class DashboardSqliteRepository implements IDashboardRepository {
  constructor(private readonly db: SqliteDB) {}

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

  async getTaskDetailRows(taskDefinitionId: string, input: { limit: number; offset: number }) {
    const db = this.db;
    const [taskRows, runs, countRows, connectionRows] = await Promise.all([
      db.select().from(taskDefinitions).where(eq(taskDefinitions.id, taskDefinitionId)).limit(1),
      db
        .select()
        .from(taskRuns)
        .where(eq(taskRuns.taskDefinitionId, taskDefinitionId))
        .orderBy(desc(taskRuns.createdAt))
        .limit(input.limit)
        .offset(input.offset),
      db
        .select({ value: count() })
        .from(taskRuns)
        .where(eq(taskRuns.taskDefinitionId, taskDefinitionId)),
      db.select().from(connections).limit(200),
    ]);

    return { task: taskRows[0] ?? null, runs, totalRuns: countRows[0]?.value ?? 0, connectionRows };
  }
}
