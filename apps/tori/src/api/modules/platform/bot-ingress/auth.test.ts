import { createMockServiceContext } from "@test/utils/service.ts";
import { Hono } from "hono";
import { beforeEach, describe, expect, it, vi } from "vite-plus/test";
import type { ManagedBotPluginInstance } from "@/api/modules/platform/bot-plugin/instance.ts";

vi.mock("@/api/modules/platform/bot-plugin/instance.ts", () => ({
  authenticateManagedBotInstance: vi.fn(),
}));

import { authenticateManagedBotInstance } from "@/api/modules/platform/bot-plugin/instance.ts";

import {
  assertBotPluginMessageContextAccess,
  extractBotPluginCredential,
  requireBotIngressAccess,
} from "./auth.js";

function createBotPluginInstance(
  overrides: Partial<ManagedBotPluginInstance> = {},
): ManagedBotPluginInstance {
  return {
    id: "bot-instance-1",
    ownerUserId: "owner-1",
    platform: "discord",
    namespace: "managed",
    instanceKey: "primary",
    name: "Discord Bot",
    callbackMode: "internal-sse",
    deliveryEndpointId: "endpoint-1",
    status: "active",
    capabilities: null,
    metadata: null,
    lastSeenAt: new Date(),
    deletedAt: null,
    createdAt: new Date(),
    updatedAt: new Date(),
    ...overrides,
  };
}

function createTestApp(ctx = createMockServiceContext({ user: null, role: undefined })) {
  const app = new Hono();

  app.use("*", async (c, next) => {
    c.set("serviceContext", ctx);
    await next();
  });
  app.use("*", requireBotIngressAccess());
  app.get("/", (c) => {
    const serviceContext = c.get("serviceContext");
    return c.json({
      userId: serviceContext.userId ?? null,
      botPluginInstanceId: c.get("botPluginInstance")?.id ?? null,
    });
  });
  app.onError((error, c) => {
    const status =
      "httpStatus" in error && typeof error.httpStatus === "number" ? error.httpStatus : 500;
    c.status(status as never);
    return c.json({ message: error.message });
  });

  return app;
}

describe("bot-ingress auth", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("keeps session-authenticated dashboard access working", async () => {
    const sessionContext = createMockServiceContext({
      user: {
        id: "session-user",
        role: "admin",
      },
    });
    const sessionApp = createTestApp(sessionContext);

    const res = await sessionApp.request("/");

    expect(res.status).toBe(200);
    expect(await res.json()).toEqual({
      userId: "session-user",
      botPluginInstanceId: null,
    });
    expect(authenticateManagedBotInstance).not.toHaveBeenCalled();
  });

  it("accepts bearer credential for external bot-plugin access", async () => {
    vi.mocked(authenticateManagedBotInstance).mockResolvedValue(createBotPluginInstance());
    const app = createTestApp();

    const res = await app.request("/", {
      headers: {
        Authorization: "Bearer bpi_test_credential",
      },
    });

    expect(res.status).toBe(200);
    expect(await res.json()).toEqual({
      userId: "owner-1",
      botPluginInstanceId: "bot-instance-1",
    });
    expect(authenticateManagedBotInstance).toHaveBeenCalledWith(
      expect.anything(),
      "bpi_test_credential",
    );
  });

  it("rejects requests without session or bot credential", async () => {
    const app = createTestApp();

    const res = await app.request("/");

    expect(res.status).toBe(401);
    expect(await res.json()).toEqual({
      message: "Bot plugin credential required",
    });
  });
});

describe("bot-ingress credential helpers", () => {
  it("extracts credential from explicit header before bearer token", () => {
    const headers = new Headers({
      "X-Bot-Plugin-Credential": "bpi_header",
      Authorization: "Bearer bpi_bearer",
    });

    expect(extractBotPluginCredential(headers)).toBe("bpi_header");
  });

  it("requires message context to match authenticated bot instance", () => {
    const instance = createBotPluginInstance({ platform: "slack", namespace: "team-a" });

    expect(() =>
      assertBotPluginMessageContextAccess(instance, {
        platform: "slack",
        namespace: "team-a",
        observedUserId: "user-1",
        observedUserName: "User One",
        observedChannelId: "channel-1",
        observedChannelName: "Channel One",
        channelName: "Channel One",
        channelType: "dm",
      }),
    ).not.toThrow();

    expect(() =>
      assertBotPluginMessageContextAccess(instance, {
        platform: "discord",
        namespace: "team-a",
        observedUserId: "user-1",
        observedUserName: "User One",
        observedChannelId: "channel-1",
        observedChannelName: "Channel One",
        channelName: "Channel One",
        channelType: "dm",
      }),
    ).toThrow("Bot plugin credential does not match messageContext.platform");

    expect(() =>
      assertBotPluginMessageContextAccess(instance, {
        platform: "slack",
        namespace: "team-b",
        observedUserId: "user-1",
        observedUserName: "User One",
        observedChannelId: "channel-1",
        observedChannelName: "Channel One",
        channelName: "Channel One",
        channelType: "dm",
      }),
    ).toThrow("Bot plugin credential does not match messageContext.namespace");
  });
});
