import { and, eq } from "drizzle-orm";
import { uniqueId } from "@repo/utils/id";
import {
  botPluginInstances,
  channelBindings,
  deliveryEndpoints,
  notificationEvents,
  subscriptions,
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

      candidates.push({ notification, ownerUserId });
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

  async createDeliveryEndpoint(input: CreateDeliveryEndpointInput) {
    const [deliveryEndpoint] = await this.db
      .insert(deliveryEndpoints)
      .values(input as typeof deliveryEndpoints.$inferInsert)
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
      .values(input as typeof subscriptions.$inferInsert)
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
      .values(input as typeof notificationEvents.$inferInsert)
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
