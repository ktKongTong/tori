import { Hono } from "hono";
import { z } from "zod";

import { requireAdmin, requireAuth } from "@/api/server/middleware/auth.ts";
import { describeRoute } from "@/api/server/middleware/openapi/index.ts";
import { registerDeliveryEndpoint, updateDeliveryEndpointStatus } from "./command";
import { createNotificationStreamResponse } from "./route-stream";

import {
  registerDeliveryEndpointDtoSchema,
  statusUpdateResponseDtoSchema,
  updateDeliveryEndpointDtoSchema,
} from "@/api/modules/platform/notify/contract";

const app = new Hono();

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

// app.get(
//   "/delivery-endpoints",
//   requireAdmin(),
//   describeRoute({
//     tags: ["Notify"],
//     summary: "List delivery endpoints",
//     response: {
//       description: "List of delivery endpoints",
//       body: z.object({
//         data: z.array(z.unknown()),
//       }),
//     },
//   }),
//   async (c) => {
//     const items = await c.get("serviceContext").repositories.notify.listDeliveryEndpoints();
//     return c.json(items);
//   },
// );

app.post(
  "/delivery-endpoints",
  requireAdmin(),
  describeRoute({
    tags: ["Notify"],
    summary: "Register delivery endpoint",
    request: { body: registerDeliveryEndpointDtoSchema },
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
        created: result.created,
        ...result.deliveryEndpoint,
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
    request: { param: z.object({ id: z.string() }), body: updateDeliveryEndpointDtoSchema },
    response: {
      description: "Updated delivery endpoint",
      body: statusUpdateResponseDtoSchema,
    },
  }),
  async (c) => {
    const { id } = c.req.valid("param");
    const body = c.req.valid("json");
    const updated = await updateDeliveryEndpointStatus(c.get("serviceContext"), id, body.status);
    return c.json({ id: updated.id, status: updated.status });
  },
);

export default app;
