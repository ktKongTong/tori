import { Hono } from "hono";
import { z } from "zod";
import { StatusConflictError } from "@/api/domain/error/index.ts";
import { createNotificationStreamResponse } from "@/api/modules/platform/notify/route-stream.ts";
import { describeRoute } from "@/api/server/middleware/openapi/index.ts";

import { assertBotPluginMessageContextAccess, requireBotIngressAccess } from "./auth.js";
import { handleBotPluginCommandRequest } from "./command.js";
import { botCommandResponseSchema } from "./response.js";
import { commandRequestSchema } from "./type.js";

const app = new Hono();

app.use("*", requireBotIngressAccess());

app.get(
  "/stream",
  describeRoute({
    tags: ["BotIngress"],
    summary: "Open bot ingress stream",
    response: { description: "SSE stream", body: z.object({ ok: z.boolean() }) },
  }),
  (c) => {
    const botPluginInstance = c.get("botPluginInstance");
    if (botPluginInstance && !botPluginInstance.deliveryEndpointId) {
      throw new StatusConflictError("Bot plugin instance has no attached delivery endpoint");
    }

    return createNotificationStreamResponse(c, {
      botPluginInstanceId: botPluginInstance?.id ?? undefined,
    });
  },
);

app.post(
  "/request",
  describeRoute({
    tags: ["BotIngress"],
    summary: "Execute bot ingress command request",
    request: { body: commandRequestSchema },
    response: { description: "Command result", body: botCommandResponseSchema },
  }),
  async (c) => {
    const input = c.req.valid("json");
    const botPluginInstance = c.get("botPluginInstance");
    if (botPluginInstance) {
      assertBotPluginMessageContextAccess(botPluginInstance, input.messageContext);
    }

    return c.json(
      await handleBotPluginCommandRequest(c.get("serviceContext"), input, {
        botPluginInstance,
      }),
    );
  },
);

export default app;
