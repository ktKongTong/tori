import { beforeEach, describe, expect, it, vi } from "vite-plus/test";

vi.mock("@repo/observability/logging", () => ({
  pinoLogger: {
    error: vi.fn(),
    debug: vi.fn(),
    warn: vi.fn(),
  },
}));

import { Hono } from "hono";
import { errorHandler } from "../error.js";
import { checkIdempotencyKey } from "./idempotency.js";

// Mock KV
const mockKV = {
  get: vi.fn(),
  set: vi.fn(),
  incr: vi.fn(),
  mget: vi.fn(),
  sadd: vi.fn(),
  smembers: vi.fn(),
  del: vi.fn(),
};

describe("checkIdempotencyKey Middleware", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("should proceed if no Idempotency-Key header", async () => {
    const app = new Hono();
    app.use("*", checkIdempotencyKey);
    app.post("/", (c) => c.json({ ok: true }));

    const res = await app.request("/", { method: "POST" });
    expect(res.status).toBe(200);
  });

  it("should return cached response if key exists", async () => {
    const app = new Hono();
    app.use("*", async (c, next) => {
      c.set("kv", mockKV);
      await next();
    });
    app.use("*", checkIdempotencyKey);
    app.post("/", (c) => c.json({ ok: true }));

    const cachedBody = { status: 200, body: { cached: true } };
    mockKV.get.mockResolvedValueOnce(null).mockResolvedValueOnce(cachedBody);

    const res = await app.request("/", {
      method: "POST",
      headers: { "Idempotency-Key": "key-1" },
      body: JSON.stringify({ ok: true }),
    });

    expect(res.status).toBe(200);
    expect(await res.json()).toEqual(cachedBody.body);
    expect(mockKV.get).toHaveBeenCalledTimes(2);
  });

  it("should cache response if key is new", async () => {
    const app = new Hono();
    app.use("*", async (c, next) => {
      c.set("kv", mockKV);
      await next();
    });
    app.use("*", checkIdempotencyKey);
    app.post("/", (c) => c.json({ new: true }));

    mockKV.get.mockResolvedValue(null);

    const res = await app.request("/", {
      method: "POST",
      headers: { "Idempotency-Key": "key-2" },
      body: JSON.stringify({ new: true }),
    });

    expect(res.status).toBe(200);
    expect(await res.json()).toEqual({ new: true });

    expect(mockKV.set).toHaveBeenCalledTimes(2);
    const [metaKey, metaVal, metaTtl] = mockKV.set.mock.calls[0];
    expect(metaKey).toContain("idempotency:meta:key-2");
    expect(metaVal).toHaveProperty("fingerprint");
    expect(metaTtl).toBe(24 * 60 * 60);
    const [responseKey, responseVal, responseTtl] = mockKV.set.mock.calls[1];
    expect(responseKey).toContain("idempotency:key-2");
    expect(responseVal).toEqual({ status: 200, body: { new: true } });
    expect(responseTtl).toBe(24 * 60 * 60);
  });

  it("should return 409 when same key is used with different payload", async () => {
    const app = new Hono();
    app.use("*", async (c, next) => {
      c.set("kv", mockKV);
      await next();
    });
    app.use("*", checkIdempotencyKey);
    app.post("/", (c) => c.json({ ok: true }));
    app.onError(errorHandler);

    mockKV.get.mockResolvedValue({ fingerprint: "old-fingerprint" });

    const res = await app.request("/", {
      method: "POST",
      headers: { "Idempotency-Key": "key-3" },
      body: JSON.stringify({ different: true }),
    });

    expect(res.status).toBe(409);
    expect(await res.json()).toEqual({
      code: "STATUS_CONFLICT",
      message: "Idempotency key already used with different payload",
    });
    expect(mockKV.set).not.toHaveBeenCalled();
  });
});
