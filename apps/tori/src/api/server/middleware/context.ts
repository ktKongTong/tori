import type { Context } from "hono";
import { createMiddleware } from "hono/factory";
import { createPinoAppLogger } from "@repo/observability/logging";
import {
  createObservationScopeFromServiceContext,
  runWithObservationScope,
} from "@/api/domain/infra/observation";
import type { ServiceContext } from "@/api/domain/infra/service-context";
import { createServiceContext } from "@/api/support/service-context";

declare module "hono" {
  interface ContextVariableMap {
    serviceContext: ServiceContext;
  }
}

export const serviceContextMiddleware = () =>
  createMiddleware(async (c: Context, next) => {
    const ctx = createServiceContext({
      traceparent: c.req.header("traceparent"),
      tracestate: c.req.header("tracestate"),
      causationType: "req",
      causationId: c.get("requestId"),
      correlationId: c.req.header("X-Correlation-ID"),
      user: c.get("user"),
      role: c.get("role"),
      auth: c.get("auth"),
      kv: c.get("kv"),
      tx: c.get("db"),
      env: c.get("appEnv"),
      queue: c.get("mq"),
      loggerFactory: createPinoAppLogger,
      source: "monoark/api",
    });
    c.set("serviceContext", ctx);
    ctx.logger.debug("request", { method: c.req.method, path: c.req.path });
    await runWithObservationScope(createObservationScopeFromServiceContext(ctx), async () => {
      await next();
    });
  });

/** Route-level middleware to refine ctx.source */
export const withSource = (source: string) =>
  createMiddleware(async (c: Context, next) => {
    const ctx = c.get("serviceContext");
    ctx.updateSourceName(source);
    await next();
  });
