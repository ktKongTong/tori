import { Hono } from "hono";
import { beforeEach, describe, expect, it, vi } from "vite-plus/test";
import { RateLimitError } from "../../domain/error/index.js";
import { rateLimitMiddleware } from "./rate-limit.js";

const createMockKV = () => {
  const store = new Map<string, number>();
  return {
    get: vi.fn(async (key: string) => store.get(key) ?? null),
    set: vi.fn(async () => "OK" as const),
    mget: vi.fn(async (...keys: string[]) => keys.map(() => null)),
    sadd: vi.fn(async () => undefined),
    smembers: vi.fn(async () => [] as string[]),
    del: vi.fn(async () => undefined),
    incr: vi.fn(async (key: string, num = 1, _ttl?: number) => {
      const current = store.get(key) ?? 0;
      const next = current + num;
      store.set(key, next);
      return next;
    }),
  };
};

describe("rateLimitMiddleware", () => {
  let mockKV: ReturnType<typeof createMockKV>;

  beforeEach(() => {
    mockKV = createMockKV();
  });

  const createApp = (category: string, maxRequests: number, windowSec = 60) => {
    const app = new Hono();
    app.use("*", async (c, next) => {
      c.set("kv" as never, mockKV as never);
      c.set("user" as never, null as never);
      await next();
    });
    app.use("*", rateLimitMiddleware(category, { windowSec, maxRequests }));
    app.get("/test", (c) => c.json({ ok: true }));
    app.onError((err, c) => {
      if (err instanceof RateLimitError) {
        const detail = err.detail as { retryAfter?: number } | undefined;
        return c.json({ error: err.message, retryAfter: detail?.retryAfter }, 429);
      }
      return c.json({ error: "unknown" }, 500);
    });
    return app;
  };

  it("should allow requests within the limit", async () => {
    const app = createApp("read", 3);

    const res = await app.request("/test");
    expect(res.status).toBe(200);
    expect(res.headers.get("X-RateLimit-Limit")).toBe("3");
    expect(res.headers.get("X-RateLimit-Remaining")).toBe("2");
    expect(res.headers.get("X-RateLimit-Reset")).toBeTruthy();
  });

  it("should block requests exceeding the limit", async () => {
    const app = createApp("write", 2);

    const res1 = await app.request("/test");
    expect(res1.status).toBe(200);

    const res2 = await app.request("/test");
    expect(res2.status).toBe(200);

    const res3 = await app.request("/test");
    expect(res3.status).toBe(429);
    const body = (await res3.json()) as { error: string };
    expect(body.error).toBe("Too many requests");
  });

  it("should set rate limit response headers", async () => {
    const app = createApp("read", 10);

    const res = await app.request("/test");
    expect(res.headers.get("X-RateLimit-Limit")).toBe("10");
    expect(res.headers.get("X-RateLimit-Remaining")).toBe("9");
    expect(res.headers.get("X-RateLimit-Reset")).toBeTruthy();
  });

  it("should use authed config for authenticated users", async () => {
    const app = new Hono();
    app.use("*", async (c, next) => {
      c.set("kv" as never, mockKV as never);
      c.set("user" as never, { id: "user-1" } as never);
      await next();
    });
    app.use(
      "*",
      rateLimitMiddleware(
        "read",
        { windowSec: 60, maxRequests: 2 },
        { windowSec: 60, maxRequests: 100 },
      ),
    );
    app.get("/test", (c) => c.json({ ok: true }));

    const res = await app.request("/test");
    expect(res.status).toBe(200);
    // authed config uses maxRequests=100
    expect(res.headers.get("X-RateLimit-Limit")).toBe("100");
    expect(res.headers.get("X-RateLimit-Remaining")).toBe("99");
  });

  it("should use different KV keys for different categories", async () => {
    const app1 = createApp("read", 1);
    const app2 = createApp("write", 1);

    // Exhaust "read" limit
    await app1.request("/test");
    const res1 = await app1.request("/test");
    expect(res1.status).toBe(429);

    // "write" should still be allowed (different category)
    const res2 = await app2.request("/test");
    expect(res2.status).toBe(200);
  });
});
