import type { Context } from "hono";

import { type NotificationStreamEvent, notifyBus } from "./bus.js";

function encodeSse(event: NotificationStreamEvent) {
  return `event: ${event.type}\ndata: ${JSON.stringify(event)}\n\n`;
}

type NotificationStreamFilter = {
  ownerUserId?: string | null;
  clientId?: string | null;
  botPluginInstanceId?: string | null;
  deliveryEndpointId?: string | null;
};

export function createNotificationStreamResponse(
  c: Context,
  filter: NotificationStreamFilter = {},
) {
  const ownerUserId = filter.ownerUserId ?? c.get("serviceContext").userId;
  const clientId = filter.clientId ?? c.req.query("clientId") ?? null;
  const botPluginInstanceId =
    filter.botPluginInstanceId ?? c.req.query("botPluginInstanceId") ?? null;
  const deliveryEndpointId = filter.deliveryEndpointId ?? c.req.query("deliveryEndpointId") ?? null;
  const encoder = new TextEncoder();
  let teardown = () => {};

  const stream = new ReadableStream<Uint8Array>({
    start(controller) {
      const push = (event: NotificationStreamEvent) => {
        controller.enqueue(encoder.encode(encodeSse(event)));
      };
      const unsubscribe = notifyBus.subscribe(
        { ownerUserId, clientId, botPluginInstanceId, deliveryEndpointId },
        push,
      );
      const heartbeat = setInterval(() => {
        push({ type: "heartbeat", timestamp: new Date().toISOString() });
      }, 15000);
      teardown = () => {
        clearInterval(heartbeat);
        unsubscribe();
      };
    },
    cancel() {
      teardown();
    },
  });

  return new Response(stream, {
    headers: {
      "content-type": "text/event-stream; charset=utf-8",
      "cache-control": "no-cache, no-transform",
      connection: "keep-alive",
      "x-accel-buffering": "no",
    },
  });
}
