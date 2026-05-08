import type { PageBasedPaginationResult } from "@repo/utils/schema/paging";
import type {
  NotificationEvent,
  Subscription,
} from "@/api/modules/platform/subscription/repository/repository.ts";
import type {
  SubscriptionDto,
  SubscriptionViewDto,
} from "@/api/modules/platform/subscription/contract";
import type { NotificationEventDto } from "@/api/modules/platform/notify/contract";

type NamedEntity = {
  id: string;
  name?: string | null;
  displayName?: string | null;
  provider?: string;
  providerAccountName?: string | null;
};

function toIso(value: Date | string | null | undefined): string | null {
  if (!value) return null;
  return value instanceof Date ? value.toISOString() : value;
}

function toNamedEntity(value: unknown): NamedEntity | null {
  if (!value || typeof value !== "object") return null;
  const record = value as Record<string, unknown>;
  return typeof record.id === "string" ? (value as NamedEntity) : null;
}

export function toSubscriptionDto(subscription: Subscription): SubscriptionDto {
  return {
    id: subscription.id,
    channelId: subscription.channelId,
    botPluginInstanceId: subscription.botPluginInstanceId ?? null,
    connectionId: subscription.connectionId,
    ownerType: subscription.ownerType,
    ownerId: subscription.ownerId,
    topicType: subscription.topicType,
    topicKey: subscription.topicKey,
    eventTypes: subscription.eventTypes,
    status: subscription.status,
    filterExpr: subscription.filterExpr ?? null,
    createdByUserId: subscription.createdByUserId ?? null,
    createdAt: toIso(subscription.createdAt) ?? new Date(0).toISOString(),
    updatedAt: toIso(subscription.updatedAt) ?? new Date(0).toISOString(),
  };
}

export function toSubscriptionViewDto(subscription: Subscription): SubscriptionViewDto {
  const channel = toNamedEntity(subscription.channel);
  const connection = toNamedEntity(subscription.connection);
  const owner = toNamedEntity(subscription.owner);
  const botInstance = toNamedEntity((subscription as { botInstance?: unknown }).botInstance);
  const ownerChannel = toNamedEntity((subscription as { ownerChannel?: unknown }).ownerChannel);

  return {
    ...toSubscriptionDto(subscription),
    channel: channel ? { id: channel.id, name: channel.name ?? null } : null,
    connection: connection
      ? {
          id: connection.id,
          provider: connection.provider ?? "",
          providerAccountName: connection.providerAccountName ?? null,
        }
      : null,
    botInstance: botInstance
      ? { id: botInstance.id, displayName: botInstance.displayName ?? null }
      : null,
    owner: owner ? { id: owner.id, name: owner.name ?? owner.displayName ?? owner.id } : null,
    ownerChannel: ownerChannel ? { id: ownerChannel.id, name: ownerChannel.name ?? null } : null,
  };
}

export function toNotificationEventDto(event: NotificationEvent): NotificationEventDto {
  return {
    id: event.id,
    subscriptionId: event.subscriptionId ?? null,
    channelId: event.channelId,
    botPluginInstanceId: event.botPluginInstanceId ?? null,
    deliveryEndpointId: event.deliveryEndpointId ?? null,
    channelBindingId: event.channelBindingId ?? null,
    title: event.title ?? null,
    body: event.body,
    payload: event.payload,
    status: event.status,
    sentAt: toIso(event.sentAt),
    failedAt: toIso(event.failedAt),
    errorMessage: event.errorMessage ?? null,
    createdAt: toIso(event.createdAt) ?? new Date(0).toISOString(),
  };
}

export function mapSubscriptionPage(
  page: PageBasedPaginationResult<Subscription>,
): PageBasedPaginationResult<SubscriptionViewDto> {
  return {
    ...page,
    data: page.data.map(toSubscriptionViewDto),
  };
}

export function mapNotificationEventPage(
  page: PageBasedPaginationResult<NotificationEvent>,
): PageBasedPaginationResult<NotificationEventDto> {
  return {
    ...page,
    data: page.data.map(toNotificationEventDto),
  };
}
