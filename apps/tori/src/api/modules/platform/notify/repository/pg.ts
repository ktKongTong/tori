import { and, eq, desc, count, isNull } from "drizzle-orm";
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
  CreateNotificationCandidatesInput,
  CreateNotificationEventInput,
  INotifyRepository,
} from "@/api/modules/platform/notify/repository/repository.ts";

export class NotifyPgRepository implements INotifyRepository {
  async listSubscriptions() {
    return this.db
      .select()
      .from(subscriptions)
      .where(isNull(subscriptions.deletedAt))
      .orderBy(desc(subscriptions.createdAt))
      .limit(100);
  }

  async listSubscriptionDetails() {
    const ownerChannel = alias(channels, "notify_owner_channel");
    const rows = await this.db
      .select({
        subscription: subscriptions,
        channel: channels,
        connection: connections,
        ownerUser: user,
        ownerChannel,
      })
      .from(subscriptions)
      .leftJoin(channels, eq(subscriptions.channelId, channels.id))
      .leftJoin(connections, eq(subscriptions.connectionId, connections.id))
      .leftJoin(user, and(eq(subscriptions.ownerType, "USER"), eq(subscriptions.ownerId, user.id)))
      .leftJoin(
        ownerChannel,
        and(eq(subscriptions.ownerType, "CHANNEL"), eq(subscriptions.ownerId, ownerChannel.id)),
      )
      .where(isNull(subscriptions.deletedAt))
      .orderBy(desc(subscriptions.createdAt))
      .limit(100);
    return rows.map(({ subscription, channel, connection, ownerUser, ownerChannel }) => ({
      ...subscription,
      channel,
      connection,
      ownerUser,
      ownerChannel,
    }));
  }

  async getSubscriptionJoinedRowById(id: string) {
    const ownerChannel = alias(channels, "notify_owner_channel");
    const [row] = await this.db
      .select({
        subscription: subscriptions,
        channel: channels,
        connection: connections,
        ownerUser: user,
        ownerChannel,
      })
      .from(subscriptions)
      .leftJoin(channels, eq(subscriptions.channelId, channels.id))
      .leftJoin(connections, eq(subscriptions.connectionId, connections.id))
      .leftJoin(user, and(eq(subscriptions.ownerType, "USER"), eq(subscriptions.ownerId, user.id)))
      .leftJoin(
        ownerChannel,
        and(eq(subscriptions.ownerType, "CHANNEL"), eq(subscriptions.ownerId, ownerChannel.id)),
      )
      .where(and(eq(subscriptions.id, id), isNull(subscriptions.deletedAt)))
      .limit(1);
    if (!row) return null;
    return {
      ...row.subscription,
      channel: row.channel,
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
      .where(and(eq(subscriptions.id, id), isNull(subscriptions.deletedAt)))
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
          isNull(subscriptions.deletedAt),
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

      const bindings = await this.db
        .select()
        .from(channelBindings)
        .where(
          and(
            eq(channelBindings.channelId, subscription.channelId),
            eq(channelBindings.status, "active"),
            isNull(channelBindings.deletedAt),
          ),
        );

      const ownerUserId =
        subscription.ownerType === "USER"
          ? subscription.ownerId
          : (subscription.createdByUserId ?? null);

      if (!bindings.length) {
        await this.createNotificationEvent({
          subscriptionId: subscription.id,
          channelId: subscription.channelId,
          title: input.title,
          body: input.body,
          payload: input.payload,
          status: "failed",
          failedAt: new Date(),
          errorMessage: "channel has no active bindings",
        });
        continue;
      }

      for (const binding of bindings) {
        const [botPluginInstance] = binding.botPluginInstanceId
          ? await this.db
              .select()
              .from(botPluginInstances)
              .where(
                and(
                  eq(botPluginInstances.id, binding.botPluginInstanceId),
                  eq(botPluginInstances.status, "active"),
                  isNull(botPluginInstances.deletedAt),
                ),
              )
              .limit(1)
          : [null];

        const [notification] = await this.db
          .insert(notificationEvents)
          .values({
            id: uniqueId(),
            subscriptionId: subscription.id,
            channelId: subscription.channelId,
            botPluginInstanceId: binding.botPluginInstanceId ?? null,
            deliveryEndpointId: botPluginInstance?.deliveryEndpointId ?? null,
            channelBindingId: binding.id,
            title: input.title,
            body: input.body,
            payload: input.payload,
          })
          .returning();

        if (!botPluginInstance) {
          await this.markNotificationFailed(notification.id, "bot instance missing or disabled");
          continue;
        }

        if (!notification.deliveryEndpointId) {
          await this.markNotificationFailed(
            notification.id,
            "bot instance has no delivery endpoint",
          );
          continue;
        }

        const deliveryEndpoint = await this.findActiveDeliveryEndpointById(
          notification.deliveryEndpointId,
        );
        if (!deliveryEndpoint) {
          await this.markNotificationFailed(
            notification.id,
            "delivery endpoint missing or disabled",
          );
          continue;
        }

        candidates.push({
          notification,
          channelBinding: binding,
          deliveryEndpoint,
          ownerUserId,
        });
      }
    }

    return candidates;
  }

  constructor(private readonly db: PGDB) {}

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
      .where(and(eq(botPluginInstances.id, id), isNull(botPluginInstances.deletedAt)))
      .limit(1);
    return instance ?? null;
  }

  async findActiveDeliveryEndpointById(id: string) {
    const [deliveryEndpoint] = await this.db
      .select()
      .from(deliveryEndpoints)
      .where(
        and(
          eq(deliveryEndpoints.id, id),
          eq(deliveryEndpoints.status, "active"),
          isNull(deliveryEndpoints.deletedAt),
        ),
      )
      .limit(1);
    return deliveryEndpoint ?? null;
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
