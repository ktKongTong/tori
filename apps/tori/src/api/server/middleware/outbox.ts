import type { Context } from "hono";
import { getRuntimeKey } from "hono/adapter";
import { createMiddleware } from "hono/factory";
import { processOutbox } from "@/api/domain/infra/eventing/index.ts";

export const outboxPostProcessorMiddleware = () =>
  createMiddleware(async (c: Context, next) => {
    await next();
    if (c.req.method === "GET") return;
    const ctx = c.get("serviceContext");
    ctx.logger.debug("outbox post-processing");
    const mq = c.get("mq");
    const outbox = ctx.repositories.outbox;

    if (getRuntimeKey() === "workerd" && c.executionCtx?.waitUntil) {
      c.executionCtx.waitUntil(processOutbox(outbox, mq, { topic: "QProducer" }));
      return;
    }

    await processOutbox(outbox, mq, { topic: "QProducer" });
  });
