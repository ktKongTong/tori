import type { NotificationDeliveryCandidate } from "@/api/domain/platform/repository/ports/notify.ts";
import { notifyBus, type StreamNotification } from "./bus.js";

const WEBHOOK_DELIVERY_ATTEMPTS = 3;
const WEBHOOK_RETRY_DELAYS_MS = [250, 1000] as const;

function sleep(ms: number) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

export function createStreamNotification(
  candidate: NotificationDeliveryCandidate,
): StreamNotification {
  const { notification } = candidate;

  return {
    ownerUserId: candidate.ownerUserId,
    id: notification.id,
    subscriptionId: notification.subscriptionId ?? null,
    channelId: notification.channelId,
    botPluginInstanceId: notification.botPluginInstanceId ?? null,
    deliveryEndpointId: notification.deliveryEndpointId ?? null,
    channelBindingId: notification.channelBindingId ?? null,
    externalChannelId: candidate.channelBinding?.externalChannelId ?? null,
    externalChannelName: candidate.channelBinding?.externalChannelName ?? null,
    platform: candidate.channelBinding?.platform ?? null,
    namespace: candidate.channelBinding?.namespace ?? null,
    status: "sent",
    title: notification.title ?? null,
    body: notification.body,
    payload: notification.payload as Record<string, unknown>,
    createdAt: notification.createdAt.toISOString(),
  };
}

async function postWebhookNotification(candidate: NotificationDeliveryCandidate) {
  const notification = createStreamNotification(candidate);
  const response = await fetch(candidate.deliveryEndpoint.target, {
    method: "POST",
    headers: {
      "content-type": "application/json",
      "x-tori-delivery-endpoint-id": candidate.deliveryEndpoint.id,
      "x-tori-notification-id": notification.id,
      ...(candidate.deliveryEndpoint.secret
        ? { "x-tori-delivery-secret": candidate.deliveryEndpoint.secret }
        : {}),
    },
    body: JSON.stringify({
      type: "notification",
      notification,
    }),
  });

  if (!response.ok) {
    const body = await response.text();
    throw new Error(
      `webhook delivery failed: ${response.status} ${response.statusText} ${body}`.trim(),
    );
  }
}

async function deliverWebhookWithRetry(candidate: NotificationDeliveryCandidate) {
  let lastError: unknown = null;

  for (let attempt = 1; attempt <= WEBHOOK_DELIVERY_ATTEMPTS; attempt += 1) {
    try {
      await postWebhookNotification(candidate);
      return;
    } catch (error) {
      lastError = error;
      const delay = WEBHOOK_RETRY_DELAYS_MS[attempt - 1];
      if (delay) await sleep(delay);
    }
  }

  throw lastError instanceof Error ? lastError : new Error(String(lastError));
}

export async function deliverNotificationCandidate(candidate: NotificationDeliveryCandidate) {
  if (candidate.deliveryEndpoint.kind === "webhook") {
    await deliverWebhookWithRetry(candidate);
    return;
  }

  notifyBus.publish(createStreamNotification(candidate));
}
