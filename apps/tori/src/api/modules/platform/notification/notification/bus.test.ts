import { describe, expect, it } from "vite-plus/test";
import { createNotificationBody } from "./body.js";
import { notifyBus } from "./bus.js";

describe("notifyBus", () => {
  it("filters notification events by botPluginInstanceId when requested", () => {
    const received: Array<{ type: string; botPluginInstanceId?: string | null }> = [];
    const unsubscribe = notifyBus.subscribe(
      {
        ownerUserId: "owner-1",
        botPluginInstanceId: "bot-instance-1",
      },
      (event) => {
        received.push({
          type: event.type,
          botPluginInstanceId:
            event.type === "notification" ? event.notification.botPluginInstanceId : null,
        });
      },
    );

    notifyBus.publish({
      ownerUserId: "owner-1",
      clientId: null,
      id: "notification-1",
      subscriptionId: "sub-1",
      channelId: "channel-1",
      botPluginInstanceId: "bot-instance-2",
      deliveryEndpointId: "endpoint-2",
      channelBindingId: "binding-1",
      externalChannelId: "external-channel-1",
      externalChannelName: "External channel",
      platform: "telegram",
      namespace: "managed",
      status: "sent",
      title: null,
      body: createNotificationBody({
        eventType: "test.notification",
        data: { message: "other endpoint" },
      }),
      payload: {},
      createdAt: new Date().toISOString(),
    });

    notifyBus.publish({
      ownerUserId: "owner-1",
      clientId: null,
      id: "notification-2",
      subscriptionId: "sub-1",
      channelId: "channel-1",
      botPluginInstanceId: "bot-instance-1",
      deliveryEndpointId: "endpoint-1",
      channelBindingId: "binding-1",
      externalChannelId: "external-channel-1",
      externalChannelName: "External channel",
      platform: "telegram",
      namespace: "managed",
      status: "sent",
      title: null,
      body: createNotificationBody({
        eventType: "test.notification",
        data: { message: "expected endpoint" },
      }),
      payload: {},
      createdAt: new Date().toISOString(),
    });

    unsubscribe();

    expect(received).toEqual([
      {
        type: "connected",
        botPluginInstanceId: null,
      },
      {
        type: "notification",
        botPluginInstanceId: "bot-instance-1",
      },
    ]);
  });
});
