import type { NotificationBody } from "./body.js";

type StreamNotification = {
  ownerUserId?: string | null;
  clientId?: string | null;
  id: string;
  subscriptionId: string | null;
  channelId: string;
  botPluginInstanceId: string | null;
  deliveryEndpointId: string | null;
  channelBindingId: string | null;
  status: string;
  title: string | null;
  body: NotificationBody;
  payload: Record<string, unknown>;
  createdAt: string;
};

type NotificationStreamEvent =
  | { type: "connected"; timestamp: string }
  | { type: "heartbeat"; timestamp: string }
  | { type: "notification"; notification: StreamNotification };

type Subscription = {
  ownerUserId?: string | null;
  clientId?: string | null;
  botPluginInstanceId?: string | null;
  deliveryEndpointId?: string | null;
  onMessage: (event: NotificationStreamEvent) => void;
};

class NotifyBus {
  private subscriptions = new Set<Subscription>();

  subscribe(
    filter: {
      ownerUserId?: string | null;
      clientId?: string | null;
      botPluginInstanceId?: string | null;
      deliveryEndpointId?: string | null;
    },
    onMessage: (event: NotificationStreamEvent) => void,
  ) {
    const sub: Subscription = {
      ownerUserId: filter.ownerUserId ?? null,
      clientId: filter.clientId ?? null,
      botPluginInstanceId: filter.botPluginInstanceId ?? null,
      deliveryEndpointId: filter.deliveryEndpointId ?? null,
      onMessage,
    };
    this.subscriptions.add(sub);
    onMessage({
      type: "connected",
      timestamp: new Date().toISOString(),
    });
    return () => this.subscriptions.delete(sub);
  }

  publish(event: StreamNotification) {
    for (const sub of this.subscriptions) {
      if (sub.ownerUserId && sub.ownerUserId !== event.ownerUserId) continue;
      if (sub.clientId && sub.clientId !== event.clientId) continue;
      if (sub.botPluginInstanceId && sub.botPluginInstanceId !== event.botPluginInstanceId)
        continue;
      if (sub.deliveryEndpointId && sub.deliveryEndpointId !== event.deliveryEndpointId) continue;
      sub.onMessage({
        type: "notification",
        notification: event,
      });
    }
  }
}

export const notifyBus = new NotifyBus();
export type { NotificationStreamEvent, StreamNotification };
