import { Hono } from "hono";
import {
  createRequestContextMiddleware,
  type CreateRequestContextMiddlewareOptions,
} from "./context.ts";
import { createErrorHandler, type ErrorHandlerOptions } from "./error-handler.ts";

export type CreateApiAppOptions<TEnv = unknown> = ErrorHandlerOptions & {
  context?: CreateRequestContextMiddlewareOptions<TEnv>;
};

export function createApiApp<TEnv = unknown>(options: CreateApiAppOptions<TEnv> = {}) {
  const app = new Hono();
  app.use("*", createRequestContextMiddleware(options.context));
  app.onError(createErrorHandler(options));
  return app;
}
