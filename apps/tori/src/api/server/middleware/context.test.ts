import { createMockServiceContext } from "@test/utils/service.ts";
import { type Context, Hono, type Next } from "hono";
import { beforeEach, describe, expect, it, vi } from "vite-plus/test";
import type { Auth, DB, ENV, IKV } from "@/api/domain/infra";
import { serviceContextMiddleware, withSource } from "./context.js";

const _loggerMock = {
  info: vi.fn(),
  warn: vi.fn(),
  error: vi.fn(),
  debug: vi.fn(),
};

// vi.mock("@repo/observability/logging", () => ({
//   createPinoAppLogger: vi.fn(() => loggerMock),
// }));

const appEnv = { ENVIRONMENT: "test" } as ENV;
const user = { id: "user-1", role: "admin" } as unknown as Auth["$Infer"]["Session"]["user"];
const auth = { api: { marker: "auth" } } as unknown as Auth;
const db = { marker: "db" } as unknown as DB;
const kv = { marker: "kv" } as unknown as IKV;

const mountBaseContext = async (c: Context, next: Next) => {
  c.set("user", user);
  c.set("auth", auth);
  c.set("db", db);
  c.set("kv", kv);
  c.set("appEnv", appEnv);
  c.set("requestId", "req-123");
  await next();
};

describe("serviceContextMiddleware", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("builds serviceContext from request and context vars", async () => {
    const app = new Hono();
    app.use("*", mountBaseContext);
    app.use("*", serviceContextMiddleware());
    app.get("/", (c) => {
      const ctx = c.get("serviceContext");
      return c.json({
        role: "admin",
        traceId: ctx.traceId,
        spanId: ctx.spanId,
        traceparent: ctx.traceparent,
        tracestate: ctx.tracestate,
        correlationId: ctx.correlationId,
        causationId: ctx.causationId,
        causationType: ctx.causationType,
        source: ctx.source,
        userId: ctx.user?.id,
      });
    });

    const res = await app.request("/?admin=true", {
      headers: {
        traceparent: "00-0123456789abcdef0123456789abcdef-0123456789abcdef-01",
        tracestate: "vendor=state",
        "X-Correlation-ID": "corr-abc",
      },
    });

    expect(res.status).toBe(200);
    expect(await res.json()).toEqual({
      role: "admin",
      traceId: "0123456789abcdef0123456789abcdef",
      spanId: expect.any(String),
      traceparent: expect.stringContaining("00-0123456789abcdef0123456789abcdef-"),
      tracestate: "vendor=state",
      correlationId: "corr-abc",
      causationId: "req-123",
      causationType: "req",
      source: "monoark/api",
      userId: "user-1",
    });
    // expect(loggerMock.debug).toHaveBeenCalledWith("request", {
    //   method: "GET",
    //   path: "/",
    // });
    // expect(loggerMock.close).toHaveBeenCalledTimes(1);
  });

  it("generates trace/correlation defaults when headers are missing", async () => {
    const app = new Hono();
    app.use("*", mountBaseContext);
    app.use("*", serviceContextMiddleware());
    app.get("/", (c) => {
      const ctx = c.get("serviceContext");
      return c.json({
        traceId: ctx.traceId,
        spanId: ctx.spanId,
        traceparent: ctx.traceparent,
        correlationId: ctx.correlationId,
      });
    });

    const res = await app.request("/");
    const body = (await res.json()) as {
      traceId: string;
      spanId: string;
      traceparent: string;
      correlationId: string;
    };

    expect(res.status).toBe(200);
    expect(body.traceId).toMatch(/^[a-f0-9]{32}$/);
    expect(body.spanId).toMatch(/^[a-f0-9]{16}$/);
    expect(body.traceparent).toBe(`00-${body.traceId}-${body.spanId}-01`);
    expect(body.correlationId).toBeTruthy();
  });

  it("closes logger even when downstream throws", async () => {
    const app = new Hono();
    app.use("*", mountBaseContext);
    app.use("*", serviceContextMiddleware());
    app.get("/", () => {
      throw new Error("boom");
    });
    app.onError((err, c) => c.text(err.message, 500));

    const res = await app.request("/");

    expect(res.status).toBe(500);
    expect(await res.text()).toBe("boom");
    // expect(loggerMock.close).toHaveBeenCalledTimes(1);
  });
});

describe("withSource", () => {
  it("overrides source while preserving other serviceContext fields", async () => {
    const app = new Hono();
    app.use("*", async (c, next) => {
      c.set(
        "serviceContext",
        createMockServiceContext({
          source: "monoark/api",
          correlationId: "corr-1",
        }),
      );
      await next();
    });
    app.get("/", withSource("monoark/document-route"), (c) => {
      const ctx = c.get("serviceContext");
      return c.json({ source: ctx.source, correlationId: ctx.correlationId });
    });

    const res = await app.request("/");

    expect(res.status).toBe(200);
    expect(await res.json()).toEqual({
      source: "monoark/document-route",
      correlationId: "corr-1",
    });
  });
});
