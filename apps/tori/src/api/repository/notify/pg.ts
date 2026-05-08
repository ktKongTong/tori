import { and, eq, desc, count } from "drizzle-orm";
import { alias } from "drizzle-orm/pg-core";
import { uniqueId } from "@repo/utils/id";
import {
  botPluginInstances,
  channels,
  channelBindings,
  connections,
  deliveryEndpoints,
  notificationEvents,
  subscriptions,
  user,
} from "@/api/db/schema/pg";
import type { PGDB } from "@/api/domain/infra";
import type {
  CreateDeliveryEndpointInput,
  CreateNotificationCandidatesInput,
  CreateNotificationEventInput,
  CreateSubscriptionInput,
  INotifyRepository,
} from "@/api/domain/platform/repository/ports/notify.ts";

export class NotifyPgRepository implements INotifyRepository {
  async listDeliveryEndpoints() {
    return this.db
      .select()
      .from(deliveryEndpoints)
      .orderBy(desc(deliveryEndpoints.createdAt))
      .limit(100);
  }

  async listSubscriptions() {
    return this.db.select().from(subscriptions).orderBy(desc(subscriptions.createdAt)).limit(100);
  }

  async listSubscriptionDetails() {
    const ownerChannel = alias(channels, "notify_owner_channel");
    const rows = await this.db
      .select({
        subscription: subscriptions,
        channel: channels,
        botInstance: botPluginInstances,
        connection: connections,
        ownerUser: user,
        ownerChannel,
      })
      .from(subscriptions)
      .leftJoin(channels, eq(subscriptions.channelId, channels.id))
      .leftJoin(botPluginInstances, eq(subscriptions.botPluginInstanceId, botPluginInstances.id))
      .leftJoin(connections, eq(subscriptions.connectionId, connections.id))
      .leftJoin(user, and(eq(subscriptions.ownerType, "USER"), eq(subscriptions.ownerId, user.id)))
      .leftJoin(
        ownerChannel,
        and(eq(subscriptions.ownerType, "CHANNEL"), eq(subscriptions.ownerId, ownerChannel.id)),
      )
      .orderBy(desc(subscriptions.createdAt))
      .limit(100);
    return rows.map(
      ({ subscription, channel, botInstance, connection, ownerUser, ownerChannel }) => ({
        ...subscription,
        channel,
        botInstance,
        connection,
        ownerUser,
        ownerChannel,
      }),
    );
  }

  async getSubscriptionJoinedRowById(id: string) {
    const ownerChannel = alias(channels, "notify_owner_channel");
    const [row] = await this.db
      .select({
        subscription: subscriptions,
        channel: channels,
        botInstance: botPluginInstances,
        connection: connections,
        ownerUser: user,
        ownerChannel,
      })
      .from(subscriptions)
      .leftJoin(channels, eq(subscriptions.channelId, channels.id))
      .leftJoin(botPluginInstances, eq(subscriptions.botPluginInstanceId, botPluginInstances.id))
      .leftJoin(connections, eq(subscriptions.connectionId, connections.id))
      .leftJoin(user, and(eq(subscriptions.ownerType, "USER"), eq(subscriptions.ownerId, user.id)))
      .leftJoin(
        ownerChannel,
        and(eq(subscriptions.ownerType, "CHANNEL"), eq(subscriptions.ownerId, ownerChannel.id)),
      )
      .where(eq(subscriptions.id, id))
      .limit(1);
    if (!row) return null;
    return {
      ...row.subscription,
      channel: row.channel,
      botInstance: row.botInstance,
      connection: row.connection,
      ownerUser: row.ownerUser,
      ownerChannel: row.ownerChannel,
    };
  }

  async listNotificationEvents() {
    return this.db
      .select()
      .from(notificationEvents)
      .orderBy(desc(notificationEvents.createdAt))
      .limit(100);
  }

  async listNotificationEventJoinedRows() {
    return this.db
      .select({
        event: notificationEvents,
        subscription: subscriptions,
        channel: channels,
        botInstance: botPluginInstances,
        endpoint: deliveryEndpoints,
      })
      .from(notificationEvents)
      .leftJoin(subscriptions, eq(notificationEvents.subscriptionId, subscriptions.id))
      .leftJoin(channels, eq(notificationEvents.channelId, channels.id))
      .leftJoin(
        botPluginInstances,
        eq(notificationEvents.botPluginInstanceId, botPluginInstances.id),
      )
      .leftJoin(deliveryEndpoints, eq(notificationEvents.deliveryEndpointId, deliveryEndpoints.id))
      .orderBy(desc(notificationEvents.createdAt))
      .limit(100);
  }

  async getSubscriptionById(id: string) {
    const [subscription] = await this.db
      .select()
      .from(subscriptions)
      .where(eq(subscriptions.id, id))
      .limit(1);
    return subscription ?? null;
  }

  async listNotificationEventsBySubscription(
    id: string,
    input: { page: number; pageSize: number },
  ) {
    const page = Math.max(1, input.page);
    const pageSize = Math.min(Math.max(1, input.pageSize), 50);

    const events = await this.db
      .select()
      .from(notificationEvents)
      .where(eq(notificationEvents.subscriptionId, id))
      .orderBy(desc(notificationEvents.createdAt))
      .limit(pageSize)
      .offset((page - 1) * pageSize);

    const [{ value: totalRuns }] = await this.db
      .select({ value: count() })
      .from(notificationEvents)
      .where(eq(notificationEvents.subscriptionId, id));

    return { events, total: totalRuns };
  }

  async createNotificationCandidates(input: CreateNotificationCandidatesInput) {
    const candidateSubscriptions = await this.db
      .select()
      .from(subscriptions)
      .where(
        and(
          eq(subscriptions.connectionId, input.connectionId),
          eq(subscriptions.status, "active"),
          eq(subscriptions.topicType, input.topicType),
        ),
      );

    const candidates = [];
    for (const subscription of candidateSubscriptions) {
      if (
        !(
          subscription.eventTypes.includes("*") || subscription.eventTypes.includes(input.eventType)
        )
      ) {
        continue;
      }

      const [binding] = await this.db
        .select()
        .from(channelBindings)
        .where(
          and(
            eq(channelBindings.channelId, subscription.channelId),
            eq(channelBindings.status, "active"),
          ),
        )
        .limit(1);

      const [botPluginInstance] = subscription.botPluginInstanceId
        ? await this.db
            .select()
            .from(botPluginInstances)
            .where(eq(botPluginInstances.id, subscription.botPluginInstanceId))
            .limit(1)
        : [null];

      const [notification] = await this.db
        .insert(notificationEvents)
        .values({
          id: uniqueId(),
          subscriptionId: subscription.id,
          channelId: subscription.channelId,
          botPluginInstanceId: subscription.botPluginInstanceId ?? null,
          deliveryEndpointId: botPluginInstance?.deliveryEndpointId ?? null,
          channelBindingId: binding?.id ?? null,
          title: input.title,
          body: input.body,
          payload: input.payload,
        })
        .returning();

      const ownerUserId =
        subscription.ownerType === "USER"
          ? subscription.ownerId
          : (subscription.createdByUserId ?? null);

      if (!notification.deliveryEndpointId) {
        await this.markNotificationFailed(
          notification.id,
          "channel binding has no delivery endpoint",
        );
        continue;
      }

      const deliveryEndpoint = await this.findActiveDeliveryEndpointById(
        notification.deliveryEndpointId,
      );
      if (!deliveryEndpoint) {
        await this.markNotificationFailed(notification.id, "delivery endpoint missing or disabled");
        continue;
      }

      candidates.push({
        notification,
        channelBinding: binding ?? null,
        deliveryEndpoint,
        ownerUserId,
      });
    }

    return candidates;
  }

  constructor(private readonly db: PGDB) {}

  async findDeliveryEndpointByTarget(target: string) {
    const [deliveryEndpoint] = await this.db
      .select()
      .from(deliveryEndpoints)
      .where(eq(deliveryEndpoints.target, target))
      .limit(1);
    return deliveryEndpoint ?? null;
  }

  async findChannelById(id: string) {
    const [channel] = await this.db.select().from(channels).where(eq(channels.id, id)).limit(1);
    return channel ?? null;
  }

  async findUserById(id: string) {
    const [row] = await this.db.select().from(user).where(eq(user.id, id)).limit(1);
    return row ?? null;
  }

  async findBotPluginInstanceById(id: string) {
    const [instance] = await this.db
      .select()
      .from(botPluginInstances)
      .where(eq(botPluginInstances.id, id))
      .limit(1);
    return instance ?? null;
  }

  async findDeliveryEndpointById(id: string) {
    const [deliveryEndpoint] = await this.db
      .select()
      .from(deliveryEndpoints)
      .where(eq(deliveryEndpoints.id, id))
      .limit(1);
    return deliveryEndpoint ?? null;
  }

  async createDeliveryEndpoint(input: CreateDeliveryEndpointInput) {
    const [deliveryEndpoint] = await this.db
      .insert(deliveryEndpoints)
      .values({
        id: uniqueId(),
        ...input,
      })
      .returning();
    return deliveryEndpoint;
  }

  async findActiveDeliveryEndpointById(id: string) {
    const [deliveryEndpoint] = await this.db
      .select()
      .from(deliveryEndpoints)
      .where(and(eq(deliveryEndpoints.id, id), eq(deliveryEndpoints.status, "active")))
      .limit(1);
    return deliveryEndpoint ?? null;
  }

  async findActiveChannelBindingByChannelId(channelId: string) {
    const [channelBinding] = await this.db
      .select()
      .from(channelBindings)
      .where(and(eq(channelBindings.channelId, channelId), eq(channelBindings.status, "active")))
      .limit(1);
    return channelBinding ?? null;
  }

  async findSubscriptionIdentity(input: {
    channelId: string;
    connectionId: string;
    botPluginInstanceId: string;
    topicType: string;
    topicKey: string;
  }) {
    const [subscription] = await this.db
      .select()
      .from(subscriptions)
      .where(
        and(
          eq(subscriptions.channelId, input.channelId),
          eq(subscriptions.connectionId, input.connectionId),
          eq(subscriptions.botPluginInstanceId, input.botPluginInstanceId),
          eq(subscriptions.topicType, input.topicType),
          eq(subscriptions.topicKey, input.topicKey),
        ),
      )
      .limit(1);
    return subscription ?? null;
  }

  async createSubscription(input: CreateSubscriptionInput) {
    const [subscription] = await this.db
      .insert(subscriptions)
      .values({
        id: uniqueId(),
        ...input,
      })
      .returning();
    return subscription;
  }

  async updateDeliveryEndpointStatus(id: string, status: string) {
    const [updated] = await this.db
      .update(deliveryEndpoints)
      .set({ status, updatedAt: new Date() })
      .where(eq(deliveryEndpoints.id, id))
      .returning();
    return updated ?? null;
  }

  async updateSubscriptionStatus(id: string, status: string) {
    const [updated] = await this.db
      .update(subscriptions)
      .set({ status, updatedAt: new Date() })
      .where(eq(subscriptions.id, id))
      .returning();
    return updated ?? null;
  }

  async createNotificationEvent(input: CreateNotificationEventInput) {
    const [notification] = await this.db
      .insert(notificationEvents)
      .values([
        {
          id: uniqueId(),
          ...input,
        },
      ])
      .returning();
    return notification;
  }

  async markNotificationFailed(id: string, errorMessage: string) {
    await this.db
      .update(notificationEvents)
      .set({
        status: "failed",
        failedAt: new Date(),
        errorMessage,
      })
      .where(eq(notificationEvents.id, id));
  }

  async markNotificationSent(id: string) {
    await this.db
      .update(notificationEvents)
      .set({
        status: "sent",
        sentAt: new Date(),
        errorMessage: null,
      })
      .where(eq(notificationEvents.id, id));
  }
}
