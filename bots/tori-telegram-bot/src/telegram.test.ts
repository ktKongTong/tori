import { describe, expect, test, vi } from "vite-plus/test";
import { createTelegramWebhookApp } from "./server.js";
import { handleTelegramUpdate, handleToriNotification } from "./telegram.js";
import type { TelegramBotConfig } from "./config.js";
import type { FetchLike } from "./types.js";

function jsonResponse(body: unknown, init?: ResponseInit) {
  return new Response(JSON.stringify(body), {
    headers: {
      "content-type": "application/json",
    },
    ...init,
  });
}

function parseRequestBody(init: RequestInit | undefined) {
  if (typeof init?.body !== "string") {
    throw new Error("Expected JSON string request body");
  }
  return JSON.parse(init.body) as unknown;
}

function createTestConfig(overrides: Partial<TelegramBotConfig> = {}): TelegramBotConfig {
  return {
    telegramBotToken: "telegram-token",
    toriBaseUrl: "http://localhost:3000",
    toriBotPluginCredential: "credential",
    platform: "telegram",
    namespace: "managed",
    pollTimeoutSeconds: 1,
    webhookPath: "/webhooks/tori/notifications",
    webhookPort: 3081,
    webhookSecret: null,
    ...overrides,
  };
}

describe("handleTelegramUpdate", () => {
  test("forwards commands to Tori bot-ingress and sends rendered Telegram reply", async () => {
    const calls: Array<{ url: string; init?: RequestInit }> = [];
    const fetchImpl: FetchLike = vi.fn(async (url, init) => {
      calls.push({ url: String(url), init });

      if (String(url).includes("/api/bot-ingress/request")) {
        return jsonResponse({
          action: "help",
          context: {
            userId: null,
            channelId: "channel-1",
            anonymousUserId: "anon-1",
            userBindingId: "user-binding-1",
            channelBindingId: "channel-binding-1",
            namespace: "managed",
          },
          state: {
            commands: ["/help", "/status"],
          },
        });
      }

      return jsonResponse({ ok: true, result: {} });
    });

    await handleTelegramUpdate({
      config: createTestConfig(),
      fetchImpl,
      logger: console,
      update: {
        update_id: 1,
        message: {
          message_id: 2,
          text: "/help",
          from: {
            id: 123,
            first_name: "Ada",
          },
          chat: {
            id: 456,
            type: "group",
            title: "Ops",
          },
        },
      },
    });

    expect(calls).toHaveLength(2);
    expect(calls[0]?.url).toBe("http://localhost:3000/api/bot-ingress/request");
    expect(calls[0]?.init?.headers).toMatchObject({
      "x-bot-plugin-credential": "credential",
    });
    expect(parseRequestBody(calls[0]?.init)).toMatchObject({
      commandName: "help",
      messageContext: {
        platform: "telegram",
        observedUserId: "123",
        observedChannelId: "456",
        channelType: "channel",
      },
    });
    expect(calls[1]?.url).toBe("https://api.telegram.org/bottelegram-token/sendMessage");
    expect(parseRequestBody(calls[1]?.init)).toMatchObject({
      chat_id: 456,
      text: "Available commands:\n/help\n/status",
    });
  });
});

describe("handleToriNotification", () => {
  test("sends notification body to Telegram external channel id", async () => {
    const calls: Array<{ url: string; init?: RequestInit }> = [];
    const fetchImpl: FetchLike = vi.fn(async (url, init) => {
      calls.push({ url: String(url), init });
      return jsonResponse({ ok: true, result: {} });
    });

    await handleToriNotification({
      config: createTestConfig(),
      fetchImpl,
      logger: console,
      notification: {
        id: "notification-1",
        subscriptionId: "sub-1",
        channelId: "internal-channel-1",
        botPluginInstanceId: "bot-instance-1",
        deliveryEndpointId: "endpoint-1",
        channelBindingId: "binding-1",
        externalChannelId: "456",
        externalChannelName: "Ops",
        platform: "telegram",
        namespace: "managed",
        status: "sent",
        title: "Steam family changed",
        body: {
          version: 1,
          blocks: [
            { type: "heading", text: "Library updated" },
            { type: "list", items: ["Game A", "Game B"] },
          ],
        },
        payload: {},
        createdAt: new Date().toISOString(),
      },
    });

    expect(calls).toHaveLength(1);
    expect(calls[0]?.url).toBe("https://api.telegram.org/bottelegram-token/sendMessage");
    expect(parseRequestBody(calls[0]?.init)).toMatchObject({
      chat_id: 456,
      text: "Steam family changed\n\nLibrary updated\n\n- Game A\n- Game B",
    });
  });
});

describe("createTelegramWebhookApp", () => {
  test("accepts Tori webhook notification and sends Telegram message", async () => {
    const calls: Array<{ url: string; init?: RequestInit }> = [];
    const fetchImpl: FetchLike = vi.fn(async (url, init) => {
      calls.push({ url: String(url), init });
      return jsonResponse({ ok: true, result: {} });
    });
    const app = createTelegramWebhookApp({
      config: createTestConfig({ webhookSecret: "secret" }),
      fetchImpl,
      logger: console,
    });

    const response = await app.request("/webhooks/tori/notifications", {
      method: "POST",
      headers: {
        "content-type": "application/json",
        "x-tori-delivery-secret": "secret",
      },
      body: JSON.stringify({
        type: "notification",
        notification: {
          id: "notification-1",
          subscriptionId: "sub-1",
          channelId: "internal-channel-1",
          botPluginInstanceId: "bot-instance-1",
          deliveryEndpointId: "endpoint-1",
          channelBindingId: "binding-1",
          externalChannelId: "456",
          externalChannelName: "Ops",
          platform: "telegram",
          namespace: "managed",
          status: "sent",
          title: null,
          body: {
            version: 1,
            blocks: [{ type: "text", text: "Webhook message" }],
          },
          payload: {},
          createdAt: new Date().toISOString(),
        },
      }),
    });

    expect(response.status).toBe(200);
    expect(await response.json()).toEqual({ ok: true });
    expect(calls).toHaveLength(1);
    expect(parseRequestBody(calls[0]?.init)).toMatchObject({
      chat_id: 456,
      text: "Webhook message",
    });
  });

  test("rejects invalid delivery secret", async () => {
    const fetchImpl: FetchLike = vi.fn(async () => jsonResponse({ ok: true, result: {} }));
    const app = createTelegramWebhookApp({
      config: createTestConfig({ webhookSecret: "secret" }),
      fetchImpl,
      logger: console,
    });

    const response = await app.request("/webhooks/tori/notifications", {
      method: "POST",
      headers: {
        "content-type": "application/json",
        "x-tori-delivery-secret": "wrong",
      },
      body: JSON.stringify({ type: "heartbeat", timestamp: new Date().toISOString() }),
    });

    expect(response.status).toBe(401);
    expect(fetchImpl).not.toHaveBeenCalled();
  });
});
