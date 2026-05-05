import { UnauthorizedError } from "@repo/core/errors/common";
import { createCorrelationId } from "@repo/core/utils/trace";
import type { Context, MiddlewareHandler } from "hono";

export type ApiRequestContext<TEnv = unknown, TSession = unknown> = {
  requestId: string;
  startedAt: Date;
  env?: TEnv;
  session?: TSession;
};

export type ResolveApiEnv<TEnv> = (context: Context) => TEnv;

export type CreateRequestContextMiddlewareOptions<TEnv = unknown> = {
  env?: TEnv | ResolveApiEnv<TEnv>;
  createRequestId?: (context: Context) => string;
  requestIdHeader?: string;
};

export type SessionResolver<TSession> = (context: Context) => Promise<TSession | null | undefined>;

export type CreateSessionMiddlewareOptions<TSession> = {
  resolve: SessionResolver<TSession>;
  required?: boolean;
};

export function createRequestContext<TEnv>(
  context: Context,
  options: CreateRequestContextMiddlewareOptions<TEnv> = {},
): ApiRequestContext<TEnv> {
  const requestId =
    options.createRequestId?.(context) ??
    context.req.header(options.requestIdHeader ?? "x-request-id") ??
    createCorrelationId();
  const apiContext: ApiRequestContext<TEnv> = {
    requestId,
    startedAt: new Date(),
  };
  if (options.env !== undefined) apiContext.env = resolveValue(options.env, context);
  return apiContext;
}

export function getApiRequestContext<TEnv = unknown, TSession = unknown>(
  context: Context,
): ApiRequestContext<TEnv, TSession> {
  return context.get("requestContext") as ApiRequestContext<TEnv, TSession>;
}

export function createRequestContextMiddleware<TEnv>(
  options: CreateRequestContextMiddlewareOptions<TEnv> = {},
): MiddlewareHandler {
  return async (context, next) => {
    const requestContext = createRequestContext(context, options);
    context.set("requestContext", requestContext);
    context.set("requestId", requestContext.requestId);
    await next();
  };
}

export function createSessionMiddleware<TSession>(
  options: CreateSessionMiddlewareOptions<TSession>,
): MiddlewareHandler {
  return async (context, next) => {
    const session = await options.resolve(context);
    if (!session && options.required) throw UnauthorizedError();
    if (session) {
      context.set("session", session);
      const requestContext = getApiRequestContext(context);
      requestContext.session = session;
    }
    await next();
  };
}

function resolveValue<TValue>(value: TValue | ((context: Context) => TValue), context: Context) {
  if (typeof value === "function") return (value as (context: Context) => TValue)(context);
  return value;
}
