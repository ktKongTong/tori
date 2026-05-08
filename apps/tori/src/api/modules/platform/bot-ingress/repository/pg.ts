import { and, desc, eq, ne } from "drizzle-orm";
import {
  bindingGrants,
  botPluginInstances,
  channelBindings,
  channels,
  claimSessions,
  connections,
  subscriptions,
  user,
  userBindings,
} from "@/api/db/schema/pg";
import type { PGDB } from "@/api/domain/infra/db";
import type { ResolvedSubscriptionTarget } from "../commands/subscription-targets";
import type {
  CreateBotIngressChannelBindingInput,
  CreateBotIngressChannelInput,
  CreateBotIngressClaimSessionInput,
  CreateBotIngressSubscriptionInput,
  CreateBotIngressUserBindingInput,
  CreateBotIngressUserInput,
  IBotIngressRepository,
} from "./repository";
import { uniqueId } from "@repo/utils/id";

export class BotIngressPgRepository implements IBotIngressRepository {
  constructor(private readonly db: PGDB) {}

  async listNamedActiveMockBotInstances() {
    const rows = await this.db
      .select()
      .from(botPluginInstances)
      .where(and(eq(botPluginInstances.platform, "mock"), eq(botPluginInstances.status, "active")))
      .limit(50);
    return rows.filter((item) => item.displayName?.trim());
  }

  async findActiveUserBindingIdentity(input: {
    platform: string;
    externalUserId: string;
    namespace: string;
  }) {
    const [binding] = await this.db
      .select()
      .from(userBindings)
      .where(
        and(
          eq(userBindings.platform, input.platform),
          eq(userBindings.externalUserId, input.externalUserId),
          eq(userBindings.namespace, input.namespace),
          eq(userBindings.status, "active"),
        ),
      )
      .limit(1);
    return binding ?? null;
  }

  async findActiveChannelBindingIdentity(input: {
    platform: string;
    externalChannelId: string;
    namespace: string;
  }) {
    const [binding] = await this.db
      .select()
      .from(channelBindings)
      .where(
        and(
          eq(channelBindings.platform, input.platform),
          eq(channelBindings.externalChannelId, input.externalChannelId),
          eq(channelBindings.namespace, input.namespace),
          eq(channelBindings.status, "active"),
        ),
      )
      .limit(1);
    return binding ?? null;
  }

  async findChannelById(channelId: string) {
    const [channel] = await this.db
      .select()
      .from(channels)
      .where(eq(channels.id, channelId))
      .limit(1);
    return channel ?? null;
  }

  async findUserById(userId: string) {
    const [row] = await this.db.select().from(user).where(eq(user.id, userId)).limit(1);
    return row ?? null;
  }

  async createAnonymousUser(input: CreateBotIngressUserInput) {
    const [row] = await this.db
      .insert(user)
      .values([
        {
          id: uniqueId(),
          ...input,
        },
      ])
      .returning();
    return row;
  }

  async createUserBinding(input: CreateBotIngressUserBindingInput) {
    const [binding] = await this.db
      .insert(userBindings)
      .values({
        id: uniqueId(),
        ...input,
      })
      .returning();
    return binding;
  }

  async updateUserBindingName(id: string, externalUserName: string) {
    const [binding] = await this.db
      .update(userBindings)
      .set({ externalUserName, updatedAt: new Date() })
      .where(eq(userBindings.id, id))
      .returning();
    return binding;
  }

  async updateAnonymousUserName(id: string, name: string) {
    const [row] = await this.db
      .update(user)
      .set({ name, updatedAt: new Date() })
      .where(eq(user.id, id))
      .returning();
    return row;
  }

  async createChannel(input: CreateBotIngressChannelInput) {
    const [channel] = await this.db.insert(channels).values(input).returning();
    return channel;
  }

  async createChannelBinding(input: CreateBotIngressChannelBindingInput) {
    const values: typeof channelBindings.$inferInsert = {
      id: input.id ?? uniqueId(),
      channelId: input.channelId,
      platform: input.platform,
      externalChannelId: input.externalChannelId,
      externalChannelName: input.externalChannelName ?? null,
      namespace: input.namespace ?? null,
      botPluginInstanceId: input.botPluginInstanceId ?? null,
      source: input.source,
      assurance: input.assurance,
      establishedByGrantId: input.establishedByGrantId ?? null,
      status: input.status ?? "active",
      supersededByBindingId: input.supersededByBindingId ?? null,
      revokedReason: input.revokedReason ?? null,
      metadata: input.metadata ?? null,
      endedAt: input.endedAt ?? undefined,
    };
    const [binding] = await this.db.insert(channelBindings).values(values).returning();
    return binding;
  }

  async updateChannelBindingContext(input: {
    id: string;
    externalChannelName: string;
    botPluginInstanceId?: string | null;
  }) {
    const [binding] = await this.db
      .update(channelBindings)
      .set({
        externalChannelName: input.externalChannelName,
        botPluginInstanceId: input.botPluginInstanceId,
        updatedAt: new Date(),
      })
      .where(eq(channelBindings.id, input.id))
      .returning();
    return binding;
  }

  async updateChannelName(id: string, name: string) {
    await this.db.update(channels).set({ name, updatedAt: new Date() }).where(eq(channels.id, id));
  }

  async listPendingClaimSessionsForContext(input: {
    anonymousUserId: string;
    platform: string;
    observedUserId: string;
    namespace: string;
  }) {
    return this.db
      .select()
      .from(claimSessions)
      .where(
        and(
          eq(claimSessions.anonymousUserId, input.anonymousUserId),
          eq(claimSessions.status, "pending"),
          eq(claimSessions.observedUserPlatform, input.platform),
          eq(claimSessions.observedUserId, input.observedUserId),
          eq(claimSessions.observedUserNamespace, input.namespace),
        ),
      );
  }

  async cancelClaimSessionsAndGrants(input: { sessionIds: string[]; grantIds: string[] }) {
    const now = new Date();
    await Promise.all([
      ...input.sessionIds.map((id) =>
        this.db
          .update(claimSessions)
          .set({ status: "cancelled", resolution: "reissued", resolvedAt: now, updatedAt: now })
          .where(eq(claimSessions.id, id)),
      ),
      ...input.grantIds.map((id) =>
        this.db
          .update(bindingGrants)
          .set({ status: "cancelled", updatedAt: now })
          .where(eq(bindingGrants.id, id)),
      ),
    ]);
  }

  async createClaimSession(input: CreateBotIngressClaimSessionInput) {
    const values: typeof claimSessions.$inferInsert = {
      id: input.id,
      initiatedFrom: input.initiatedFrom,
      purpose: input.purpose,
      subjectType: input.subjectType,
      subjectId: input.subjectId ?? null,
      anonymousUserId: input.anonymousUserId ?? null,
      anonymousUserName: input.anonymousUserName ?? null,
      observedUserPlatform: input.observedUserPlatform ?? null,
      observedUserId: input.observedUserId ?? null,
      observedUserName: input.observedUserName ?? null,
      observedUserNamespace: input.observedUserNamespace ?? null,
      observedChannelPlatform: input.observedChannelPlatform ?? null,
      observedChannelId: input.observedChannelId ?? null,
      observedChannelName: input.observedChannelName ?? null,
      observedChannelNamespace: input.observedChannelNamespace ?? null,
      grantId: input.grantId ?? null,
      status: input.status,
      resolvedUserId: input.resolvedUserId ?? null,
      resolvedChannelId: input.resolvedChannelId ?? null,
      resolution: input.resolution ?? null,
      metadata: input.metadata ?? null,
      resolvedAt: input.resolvedAt ?? undefined,
    };
    const [claimSession] = await this.db.insert(claimSessions).values(values).returning();
    return claimSession;
  }

  async resolveActiveConnectionForUser(input: { userId: string; provider?: string }) {
    const [row] = await this.db
      .select()
      .from(connections)
      .where(
        and(
          eq(connections.ownerUserId, input.userId),
          eq(connections.status, "active"),
          input.provider ? eq(connections.provider, input.provider) : undefined,
        ),
      )
      .orderBy(
        desc(connections.isDefault),
        desc(connections.connectedAt),
        desc(connections.updatedAt),
      )
      .limit(1);
    return row ?? null;
  }

  async findPendingClaimSessionForContext(input: {
    anonymousUserId: string;
    platform: string;
    observedUserId: string;
    namespace: string;
  }) {
    const rows = await this.db
      .select()
      .from(claimSessions)
      .where(
        and(
          eq(claimSessions.anonymousUserId, input.anonymousUserId),
          eq(claimSessions.status, "pending"),
          eq(claimSessions.observedUserPlatform, input.platform),
          eq(claimSessions.observedUserId, input.observedUserId),
          eq(claimSessions.observedUserNamespace, input.namespace),
        ),
      )
      .orderBy(desc(claimSessions.createdAt))
      .limit(1);
    return rows[0] ?? null;
  }

  async findPendingBindingGrantByTokenHash(tokenHash: string) {
    const [grant] = await this.db
      .select()
      .from(bindingGrants)
      .where(and(eq(bindingGrants.tokenHash, tokenHash), eq(bindingGrants.status, "pending")))
      .limit(1);
    return grant ?? null;
  }

  async markBindingGrantConsumed(grantId: string, now = new Date()) {
    await this.db
      .update(bindingGrants)
      .set({ status: "consumed", consumedAt: now, usedCount: 1, updatedAt: now })
      .where(eq(bindingGrants.id, grantId));
  }

  async supersedeUserBinding(id: string, now = new Date()) {
    await this.db
      .update(userBindings)
      .set({ status: "superseded", endedAt: now, updatedAt: now })
      .where(eq(userBindings.id, id));
  }

  async createConfirmedUserBinding(input: CreateBotIngressUserBindingInput) {
    return this.createUserBinding(input);
  }

  async markAnonymousUserMerged(input: {
    anonymousUserId: string;
    targetUserId: string;
    now?: Date;
  }) {
    const now = input.now ?? new Date();
    await this.db
      .update(user)
      .set({ mergedIntoUserId: input.targetUserId, claimedAt: now, updatedAt: now })
      .where(eq(user.id, input.anonymousUserId));
  }

  async markUserBindingSupersededBy(input: { id: string; supersededByBindingId: string }) {
    await this.db
      .update(userBindings)
      .set({ supersededByBindingId: input.supersededByBindingId })
      .where(eq(userBindings.id, input.id));
  }

  async supersedeChannelBinding(id: string, now = new Date()) {
    await this.db
      .update(channelBindings)
      .set({ status: "superseded", endedAt: now, updatedAt: now })
      .where(eq(channelBindings.id, id));
  }

  async createConfirmedChannelBinding(input: CreateBotIngressChannelBindingInput) {
    return this.createChannelBinding(input);
  }

  async markChannelBindingSupersededBy(input: { id: string; supersededByBindingId: string }) {
    await this.db
      .update(channelBindings)
      .set({ supersededByBindingId: input.supersededByBindingId })
      .where(eq(channelBindings.id, input.id));
  }

  async findActiveConnectionForOwnerProvider(input: { ownerUserId: string; provider: string }) {
    const [connection] = await this.db
      .select()
      .from(connections)
      .where(
        and(
          eq(connections.ownerUserId, input.ownerUserId),
          eq(connections.provider, input.provider),
          eq(connections.status, "active"),
        ),
      )
      .limit(1);
    return connection ?? null;
  }

  async markOnlyDefaultConnection(input: {
    ownerUserId: string;
    provider: string;
    connectionId: string;
  }) {
    await Promise.all([
      this.db
        .update(connections)
        .set({ isDefault: false, updatedAt: new Date() })
        .where(
          and(
            eq(connections.ownerUserId, input.ownerUserId),
            eq(connections.provider, input.provider),
            eq(connections.status, "active"),
            ne(connections.id, input.connectionId),
          ),
        ),
      this.db
        .update(connections)
        .set({ isDefault: true, updatedAt: new Date() })
        .where(eq(connections.id, input.connectionId)),
    ]);
  }

  async findMatchingSubscription(target: ResolvedSubscriptionTarget) {
    const rows = await this.db
      .select()
      .from(subscriptions)
      .where(
        and(
          eq(subscriptions.channelId, target.channelId),
          eq(subscriptions.botPluginInstanceId, target.botPluginInstanceId),
          eq(subscriptions.connectionId, target.connectionId),
          eq(subscriptions.ownerType, target.ownerType),
          eq(subscriptions.ownerId, target.ownerId),
          eq(subscriptions.topicType, target.topicType),
          eq(subscriptions.topicKey, target.topicKey),
        ),
      );

    const expected = JSON.stringify([...target.eventTypes].sort());
    return rows.find((row) => JSON.stringify([...row.eventTypes].sort()) === expected) ?? null;
  }

  async createSubscription(input: CreateBotIngressSubscriptionInput) {
    const [subscription] = await this.db.insert(subscriptions).values(input).returning();
    return subscription;
  }

  async updateSubscriptionStatus(id: string, status: string) {
    const [subscription] = await this.db
      .update(subscriptions)
      .set({ status, updatedAt: new Date() })
      .where(eq(subscriptions.id, id))
      .returning();
    return subscription;
  }

  async listActiveSubscriptionsByChannelId(channelId: string) {
    return this.db
      .select()
      .from(subscriptions)
      .where(and(eq(subscriptions.channelId, channelId), eq(subscriptions.status, "active")));
  }
}
