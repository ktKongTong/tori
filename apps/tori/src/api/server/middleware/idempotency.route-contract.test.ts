import { describe, expect, it, vi } from "vite-plus/test";

vi.mock("@repo/observability/logging", () => ({
  pinoLogger: {
    error: vi.fn(),
    debug: vi.fn(),
    warn: vi.fn(),
  },
}));

import { Hono } from "hono";
import { MemoryKV } from "@repo/storage/kv";
import { errorHandler } from "../error.js";
import { checkIdempotencyKey } from "./idempotency.js";

describe("idempotency route contract", () => {
  it("should return 409 with STATUS_CONFLICT for same key with different payloads", async () => {
    const app = new Hono();
    const kv = new MemoryKV();

    app.use("*", async (c, next) => {
      c.set("kv", kv);
      await next();
    });
    app.use("*", checkIdempotencyKey);

    app.post("/api/demo", async (c) => {
      const body = await c.req.json();
      return c.json({ ok: true, input: body });
    });

    app.onError(errorHandler);

    const headers = {
      "Idempotency-Key": "route-contract-1",
      "Content-Type": "application/json",
    };

    const first = await app.request("/api/demo", {
      method: "POST",
      headers,
      body: JSON.stringify({ value: 1 }),
    });
    expect(first.status).toBe(200);

    const second = await app.request("/api/demo", {
      method: "POST",
      headers,
      body: JSON.stringify({ value: 2 }),
    });

    expect(second.status).toBe(409);
    await expect(second.json()).resolves.toEqual(
      expect.objectContaining({
        code: "STATUS_CONFLICT",
        message: "Idempotency key already used with different payload",
      }),
    );
  });

  it("should replay cached response for same key with same payload without re-running handler", async () => {
    const app = new Hono();
    const kv = new MemoryKV();
    let handledCount = 0;

    app.use("*", async (c, next) => {
      c.set("kv", kv);
      await next();
    });
    app.use("*", checkIdempotencyKey);

    app.post("/api/demo", async (c) => {
      const body = await c.req.json();
      handledCount += 1;
      return c.json({ ok: true, handledCount, input: body });
    });

    app.onError(errorHandler);

    const headers = {
      "Idempotency-Key": "route-contract-2",
      "Content-Type": "application/json",
    };
    const body = JSON.stringify({ value: 100 });

    const first = await app.request("/api/demo", {
      method: "POST",
      headers,
      body,
    });
    expect(first.status).toBe(200);
    const firstJson = await first.json();

    const replay = await app.request("/api/demo", {
      method: "POST",
      headers,
      body,
    });

    expect(replay.status).toBe(200);
    await expect(replay.json()).resolves.toEqual(firstJson);
    expect(handledCount).toBe(1);
  });
});
