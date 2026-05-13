import { Hono } from "hono";
import { z } from "zod";
import { requireAdmin, requireAuth } from "@/api/server/middleware/auth.ts";
import { describeRoute } from "@/api/server/middleware/openapi/index.ts";
import { NotFoundError } from "@/api/domain/error/index.ts";

import {
  attachManagedBotInstanceEndpoint,
  createManagedBotInstance,
  deleteManagedBotInstance,
  listManagedBotInstances,
  revokeManagedBotInstance,
  rotateManagedBotInstanceCredential,
  updateManagedBotInstance,
} from "./instance.js";
import { attachEndpointSchema, createBotInstanceSchema, updateBotInstanceSchema } from "./type.js";
import { PageBasedPaginationParamSchema } from "@repo/utils/schema/paging";
import {
  attachBotInstanceEndpointResponseDtoSchema,
  botInstanceListDtoSchema,
  botInstanceStatusResponseDtoSchema,
  createBotInstanceResponseDtoSchema,
  rotateBotInstanceCredentialResponseDtoSchema,
} from "@/api/modules/platform/bot-plugin/contract";
import {
  createActionCheckResponse,
  actionCheckRequestSchema,
  actionCheckResponseSchema,
} from "@/api/modules/platform/shared/action-check.ts";
import { getBotPluginRepository } from "./repository/index.js";

const app = new Hono();

app.use("*", requireAuth());

app.get(
  "/instances",
  describeRoute({
    tags: ["BotPlugin"],
    summary: "List managed bot instances",
    request: { query: PageBasedPaginationParamSchema },
    response: {
      description: "Bot instances",
      body: botInstanceListDtoSchema,
    },
  }),
  async (c) => {
    const page = c.req.valid("query");
    const ctx = c.get("serviceContext");
    const items = await listManagedBotInstances(ctx, page);
    return c.json({
      ...items,
      data: items.data.map((row) => ({
        id: row.id,
        ownerUserId: row.ownerUserId,
        platform: row.platform,
        namespace: row.namespace ?? "managed",
        instanceKey: row.instanceKey,
        name: row.name ?? null,
        callbackMode: row.callbackMode,
        deliveryEndpointId: row.deliveryEndpointId ?? null,
        status: row.status,
        canManage: ctx.isAdmin(),
        lastSeenAt: row.lastSeenAt?.toISOString() ?? null,
      })),
    });
  },
);

app.post(
  "/instances",
  requireAdmin(),
  describeRoute({
    tags: ["BotPlugin"],
    summary: "Create managed bot instance",
    request: { body: createBotInstanceSchema },
    response: {
      description: "Bot instance created",
      body: createBotInstanceResponseDtoSchema,
    },
  }),
  async (c) => {
    const result = await createManagedBotInstance(c.get("serviceContext"), c.req.valid("json"));
    return c.json(
      {
        id: result.instance.id,
        platform: result.instance.platform,
        namespace: result.instance.namespace ?? "managed",
        instanceKey: result.instance.instanceKey,
        deliveryEndpointId: result.instance.deliveryEndpointId ?? null,
        plaintextCredential: result.plaintextCredential,
        created: result.created,
      },
      201,
    );
  },
);

app.patch(
  "/instances/:id",
  requireAdmin(),
  describeRoute({
    tags: ["BotPlugin"],
    summary: "Update managed bot instance",
    request: { param: z.object({ id: z.string() }), body: updateBotInstanceSchema },
    response: {
      description: "Updated bot instance",
      body: botInstanceStatusResponseDtoSchema,
    },
  }),
  async (c) => {
    const updated = await updateManagedBotInstance(
      c.get("serviceContext"),
      c.req.valid("param").id,
      c.req.valid("json"),
    );
    return c.json({ id: updated.id, status: updated.status });
  },
);

app.post(
  "/instances/:id/action-check",
  requireAdmin(),
  describeRoute({
    tags: ["BotPlugin"],
    summary: "Check bot instance action impact",
    request: {
      param: z.object({ id: z.string() }),
      body: actionCheckRequestSchema,
    },
    response: {
      description: "Bot action impact",
      body: actionCheckResponseSchema,
    },
  }),
  async (c) => {
    const { id } = c.req.valid("param");
    const { action } = c.req.valid("json");
    const ctx = c.get("serviceContext");
    const instance = await getBotPluginRepository(ctx).findManagedBotInstanceById(id);
    if (!instance) throw new NotFoundError("Bot plugin instance not found");
    if (!ctx.isAdmin() && instance.ownerUserId !== ctx.userId) {
      throw new NotFoundError("Bot plugin instance not found");
    }
    return c.json(
      createActionCheckResponse({
        resource: {
          type: "bot_instance",
          id: instance.id,
          label: instance.name ?? instance.instanceKey,
          currentStatus: instance.status,
        },
        action,
        summary:
          action === "delete"
            ? "This bot instance will be hidden from normal lists and runtime credentials are invalidated. Related channel bindings are suspended asynchronously; subscriptions are retained."
            : "This bot instance stops runtime credential auth and notification delivery immediately.",
        affected: [
          {
            type: "channel_binding",
            action: action === "delete" ? "async-disable" : "none",
            reason: "Deleted bot instances suspend related channel bindings asynchronously.",
          },
        ],
        retained: [
          { type: "notification_event", action: "retain", reason: "Delivery history is retained." },
        ],
        runtimeEffects: [
          "Runtime credential auth rejects disabled, deleted, or revoked bot instances.",
          "Notification candidate generation rejects disabled, deleted, or revoked bot instances.",
        ],
      }),
    );
  },
);

app.post(
  "/instances/:id/rotate-credential",
  requireAdmin(),
  describeRoute({
    tags: ["BotPlugin"],
    summary: "Rotate managed bot instance credential",
    request: { param: z.object({ id: z.string() }) },
    response: {
      description: "Rotated credential",
      body: rotateBotInstanceCredentialResponseDtoSchema,
    },
  }),
  async (c) =>
    c.json(
      await rotateManagedBotInstanceCredential(c.get("serviceContext"), c.req.valid("param").id),
    ),
);

app.post(
  "/instances/:id/revoke",
  requireAdmin(),
  describeRoute({
    tags: ["BotPlugin"],
    summary: "Revoke managed bot instance",
    request: { param: z.object({ id: z.string() }) },
    response: {
      description: "Revoked bot instance",
      body: botInstanceStatusResponseDtoSchema,
    },
  }),
  async (c) => {
    const updated = await revokeManagedBotInstance(
      c.get("serviceContext"),
      c.req.valid("param").id,
    );
    return c.json({ id: updated.id, status: updated.status });
  },
);

app.delete(
  "/instances/:id",
  requireAdmin(),
  describeRoute({
    tags: ["BotPlugin"],
    summary: "Delete managed bot instance",
    request: { param: z.object({ id: z.string() }) },
    response: {
      description: "Deleted bot instance",
      body: botInstanceStatusResponseDtoSchema,
    },
  }),
  async (c) => {
    return c.json(await deleteManagedBotInstance(c.get("serviceContext"), c.req.valid("param").id));
  },
);

app.post(
  "/instances/:id/attach-endpoint",
  requireAdmin(),
  describeRoute({
    tags: ["BotPlugin"],
    summary: "Attach delivery endpoint to bot instance",
    request: { param: z.object({ id: z.string() }), body: attachEndpointSchema },
    response: {
      description: "Updated bot instance",
      body: attachBotInstanceEndpointResponseDtoSchema,
    },
  }),
  async (c) => {
    const updated = await attachManagedBotInstanceEndpoint(
      c.get("serviceContext"),
      c.req.valid("param").id,
      c.req.valid("json"),
    );
    return c.json({ id: updated.id, deliveryEndpointId: updated.deliveryEndpointId ?? null });
  },
);

export default app;
