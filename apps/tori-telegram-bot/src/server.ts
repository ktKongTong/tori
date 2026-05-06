import { serve, type ServerType } from "@hono/node-server";
import { Hono } from "hono";
import type { TelegramBotConfig } from "./config.js";
import { handleToriNotification } from "./telegram.js";
import type { FetchLike, Logger, ToriNotificationStreamEvent } from "./types.js";

export function createTelegramWebhookApp(input: {
  config: TelegramBotConfig;
  fetchImpl: FetchLike;
  logger: Logger;
}) {
  const app = new Hono();

  app.get("/healthz", (c) => c.json({ ok: true }));

  app.post(input.config.webhookPath, async (c) => {
    if (input.config.webhookSecret) {
      const secret = c.req.header("x-tori-delivery-secret") ?? "";
      if (secret !== input.config.webhookSecret) {
        return c.json({ ok: false, error: "invalid delivery secret" }, 401);
      }
    }

    const event = (await c.req.json()) as ToriNotificationStreamEvent;
    if (event.type !== "notification") {
      return c.json({ ok: true, ignored: true });
    }

    await handleToriNotification({
      config: input.config,
      fetchImpl: input.fetchImpl,
      logger: input.logger,
      notification: event.notification,
    });

    return c.json({ ok: true });
  });

  return app;
}

export function runTelegramWebhookServer(input: {
  config: TelegramBotConfig;
  fetchImpl?: FetchLike;
  logger?: Logger;
  signal?: AbortSignal;
}) {
  const fetchImpl = input.fetchImpl ?? fetch;
  const logger = input.logger ?? console;
  const app = createTelegramWebhookApp({
    config: input.config,
    fetchImpl,
    logger,
  });
  const server = serve({
    fetch: app.fetch,
    port: input.config.webhookPort,
  }) as ServerType;

  logger.info(
    `Tori Telegram notification webhook listening on :${input.config.webhookPort}${input.config.webhookPath}`,
  );

  input.signal?.addEventListener(
    "abort",
    () => {
      server.close();
    },
    { once: true },
  );

  return server;
}
