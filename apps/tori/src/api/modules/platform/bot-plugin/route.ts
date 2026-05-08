import { Hono } from "hono";
import { z } from "zod";
import { requireAdmin, requireAuth } from "@/api/server/middleware/auth.ts";
import { describeRoute } from "@/api/server/middleware/openapi/index.ts";

import {
  attachManagedBotInstanceEndpoint,
  createManagedBotInstance,
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

const app = new Hono();

app.use("*", requireAuth());

app.get(
  "/instances",
  requireAdmin(),
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
    const items = await listManagedBotInstances(c.get("serviceContext"), page);
    return c.json({
      ...items,
      data: items.data.map((row) => ({
        id: row.id,
        ownerUserId: row.ownerUserId,
        platform: row.platform,
        namespace: row.namespace ?? "managed",
        instanceKey: row.instanceKey,
        displayName: row.displayName ?? null,
        callbackMode: row.callbackMode,
        deliveryEndpointId: row.deliveryEndpointId ?? null,
        status: row.status,
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
