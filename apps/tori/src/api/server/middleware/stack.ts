import type { ApiApp } from "../types.js";
import { type AdapterOptions, adapterMiddleware } from "./adapter.js";
import { betterAuthMiddleware, userMiddleware } from "./auth.js";
import { serviceContextMiddleware } from "./context.js";
import { corsMiddleware } from "./cors.js";
import { outboxPostProcessorMiddleware } from "./outbox.js";
import { traceMiddleware } from "./trace.js";

export function registerApiMiddleware(app: ApiApp, adapter: AdapterOptions) {
  app.use(traceMiddleware());
  app.use(adapterMiddleware(adapter));
  app.use(corsMiddleware());
  app.use(betterAuthMiddleware);
  app.use(userMiddleware);
  app.use(serviceContextMiddleware());
  app.use(outboxPostProcessorMiddleware());
}
