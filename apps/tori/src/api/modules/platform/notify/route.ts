import { Hono } from "hono";
import { z } from "zod";

import { requireAdmin, requireAuth } from "@/api/server/middleware/auth.ts";
import { describeRoute } from "@/api/server/middleware/openapi/index.ts";
import {
  createSubscription,
  registerDeliveryEndpoint,
  updateDeliveryEndpointStatus,
  updateSubscriptionStatus,
} from "./command.js";
import { createNotificationStreamResponse } from "./route-stream.js";

const app = new Hono();

const registerDeliveryEndpointSchema = z.object({
  platform: z.string().min(1),
  kind: z.string().min(1),
  target: z.string().min(1),
  displayName: z.string().nullable().optional(),
  secret: z.string().nullable().optional(),
  config: z.record(z.string(), z.any()).optional(),
  metadata: z.record(z.string(), z.any()).optional(),
});

const createSubscriptionSchema = z.object({
  channelId: z.string().min(1),
  botPluginInstanceId: z.string().optional(),
  connectionId: z.string().min(1),
  ownerType: z.enum(["USER", "CHANNEL"]),
  ownerId: z.string().optional(),
  topicType: z.string().min(1),
  topicKey: z.string().min(1),
  eventTypes: z.array(z.string().min(1)).min(1),
  filterExpr: z.record(z.string(), z.any()).optional(),
});

const updateDeliveryEndpointSchema = z.object({
  status: z.enum(["active", "disabled"]),
});

const updateSubscriptionSchema = z.object({
  status: z.enum(["active", "disabled"]),
});

app.use("*", requireAuth());

app.get(
  "/stream",
  describeRoute({
    tags: ["Notify"],
    summary: "Open notification stream",
    response: { description: "SSE stream", body: z.object({ ok: z.boolean() }) },
  }),
  (c) => createNotificationStreamResponse(c),
);

app.post(
  "/delivery-endpoints",
  requireAdmin(),
  describeRoute({
    tags: ["Notify"],
    summary: "Register delivery endpoint",
    request: { body: registerDeliveryEndpointSchema },
    response: {
      description: "Delivery endpoint",
      body: z.object({
        id: z.string(),
        ownerUserId: z.string().nullable(),
        platform: z.string(),
        kind: z.string(),
        target: z.string(),
        displayName: z.string().nullable(),
        status: z.string(),
        created: z.boolean(),
      }),
    },
  }),
  async (c) => {
    const body = c.req.valid("json");
    const result = await registerDeliveryEndpoint(c.get("serviceContext"), body);

    return c.json(
      {
        id: result.deliveryEndpoint.id,
        ownerUserId: result.deliveryEndpoint.ownerUserId ?? null,
        platform: result.deliveryEndpoint.platform,
        kind: result.deliveryEndpoint.kind,
        target: result.deliveryEndpoint.target,
        displayName: result.deliveryEndpoint.displayName ?? null,
        status: result.deliveryEndpoint.status,
        created: result.created,
      },
      201,
    );
  },
);

app.patch(
  "/delivery-endpoints/:id",
  requireAdmin(),
  describeRoute({
    tags: ["Notify"],
    summary: "Update delivery endpoint status",
    request: { param: z.object({ id: z.string() }), body: updateDeliveryEndpointSchema },
    response: {
      description: "Updated delivery endpoint",
      body: z.object({ id: z.string(), status: z.string() }),
    },
  }),
  async (c) => {
    const { id } = c.req.valid("param");
    const body = c.req.valid("json");
    const updated = await updateDeliveryEndpointStatus(c.get("serviceContext"), id, body.status);
    return c.json({ id: updated.id, status: updated.status });
  },
);

app.post(
  "/subscriptions",
  describeRoute({
    tags: ["Notify"],
    summary: "Create subscription",
    request: { body: createSubscriptionSchema },
    response: {
      description: "Created subscription",
      body: z.object({
        id: z.string(),
        channelId: z.string(),
        botPluginInstanceId: z.string(),
        connectionId: z.string(),
        ownerType: z.enum(["USER", "CHANNEL"]),
        ownerId: z.string(),
        topicType: z.string(),
        topicKey: z.string(),
        eventTypes: z.array(z.string()),
        status: z.string(),
        created: z.boolean(),
      }),
    },
  }),
  async (c) => {
    const body = c.req.valid("json");
    const result = await createSubscription(c.get("serviceContext"), body);

    return c.json(
      {
        id: result.subscription.id,
        channelId: result.subscription.channelId,
        botPluginInstanceId: result.subscription.botPluginInstanceId,
        connectionId: result.subscription.connectionId,
        ownerType: result.subscription.ownerType as "USER" | "CHANNEL",
        ownerId: result.subscription.ownerId,
        topicType: result.subscription.topicType,
        topicKey: result.subscription.topicKey,
        eventTypes: result.subscription.eventTypes,
        status: result.subscription.status,
        created: result.created,
      },
      201,
    );
  },
);

app.patch(
  "/subscriptions/:id",
  requireAdmin(),
  describeRoute({
    tags: ["Notify"],
    summary: "Update subscription status",
    request: { param: z.object({ id: z.string() }), body: updateSubscriptionSchema },
    response: {
      description: "Updated subscription",
      body: z.object({ id: z.string(), status: z.string() }),
    },
  }),
  async (c) => {
    const { id } = c.req.valid("param");
    const body = c.req.valid("json");
    const updated = await updateSubscriptionStatus(c.get("serviceContext"), id, body.status);
    return c.json({ id: updated.id, status: updated.status });
  },
);

export default app;
