import { describe, expect, it, vi } from "vite-plus/test";
import type { NotificationDeliveryCandidate } from "@/api/modules/platform/notify/repository/repository.ts";
import { createNotificationBody } from "./body.js";
import { deliverNotificationCandidate } from "./delivery.js";

function createCandidate(): NotificationDeliveryCandidate {
  const now = new Date();

  return {
    ownerUserId: "owner-1",
    channelBinding: {
      id: "binding-1",
      channelId: "channel-1",
      platform: "telegram",
      externalChannelId: "123",
      externalChannelName: "Ops",
      namespace: "managed",
      botPluginInstanceId: "bot-instance-1",
      source: "bot-plugin",
      assurance: "self-asserted",
      establishedByGrantId: null,
      status: "active",
      suspendedReason: null,
      metadata: null,
      deletedAt: null,
      createdAt: now,
      updatedAt: now,
    },
    deliveryEndpoint: {
      id: "endpoint-1",
      ownerUserId: "owner-1",
      platform: "telegram",
      kind: "webhook",
      name: "Telegram webhook",
      target: "https://plugin.example.test/webhooks/tori/notifications",
      secret: "secret",
      status: "active",
      config: null,
      metadata: null,
      lastUsedAt: null,
      createdAt: now,
      updatedAt: now,
    },
    notification: {
      id: "notification-1",
      subscriptionId: "sub-1",
      channelId: "channel-1",
      botPluginInstanceId: "bot-instance-1",
      deliveryEndpointId: "endpoint-1",
      channelBindingId: "binding-1",
      title: "Changed",
      body: createNotificationBody([{ type: "text", text: "Hello" }]),
      payload: {},
      status: "pending",
      sentAt: null,
      failedAt: null,
      errorMessage: null,
      createdAt: now,
    },
  };
}

describe("deliverNotificationCandidate", () => {
  it("posts webhook delivery with notification envelope and secret", async () => {
    const calls: Array<[string | URL, RequestInit | undefined]> = [];
    const fetchMock = vi.fn(async (input: string | URL, init?: RequestInit) => {
      calls.push([input, init]);
      return new Response("ok");
    });
    vi.stubGlobal("fetch", fetchMock);

    await deliverNotificationCandidate(createCandidate());

    expect(fetchMock).toHaveBeenCalledWith(
      "https://plugin.example.test/webhooks/tori/notifications",
      expect.objectContaining({
        method: "POST",
        headers: expect.objectContaining({
          "x-tori-delivery-secret": "secret",
          "x-tori-notification-id": "notification-1",
        }),
      }),
    );
    const requestInit = calls[0]?.[1];
    if (typeof requestInit?.body !== "string") {
      throw new Error("Expected JSON string request body");
    }
    expect(JSON.parse(requestInit.body)).toMatchObject({
      type: "notification",
      notification: {
        id: "notification-1",
        externalChannelId: "123",
        platform: "telegram",
      },
    });
  });

  it("retries webhook delivery before failing", async () => {
    vi.useFakeTimers();
    const fetchMock = vi.fn(async () => new Response("no", { status: 500 }));
    vi.stubGlobal("fetch", fetchMock);

    const delivery = deliverNotificationCandidate(createCandidate());
    const assertion = expect(delivery).rejects.toThrow("webhook delivery failed");
    await vi.runAllTimersAsync();

    await assertion;
    expect(fetchMock).toHaveBeenCalledTimes(3);
    vi.useRealTimers();
  });
});
