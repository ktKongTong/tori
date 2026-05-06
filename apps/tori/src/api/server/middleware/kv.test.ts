import { Hono } from "hono";
import { describe, expect, it, vi } from "vite-plus/test";
import type { IKV } from "@/api/domain/infra";
import { kvMiddleware } from "./adapter.js";

type MockKV = IKV & {
  marker: string;
  setSpy: ReturnType<typeof vi.fn>;
};

function createMockKV(marker: string): MockKV {
  const setSpy = vi.fn();
  return {
    marker,
    incr: vi.fn(async () => 1),
    set: async <T>(key: string, value: T, _ttl?: number) => {
      setSpy(key, value);
      return value;
    },
    mget: async <TData extends unknown[]>(..._args: string[] | [string[]]): Promise<TData> =>
      [] as unknown as TData,
    get: vi.fn(async () => null),
    sadd: vi.fn(async () => undefined),
    smembers: vi.fn(async () => []),
    del: vi.fn(async () => undefined),
    setSpy,
  };
}

describe("kvMiddleware", () => {
  it("calls the injected factory and stores kv on context", async () => {
    const kv = createMockKV("sync");
    const factory = vi.fn(() => kv);

    const app = new Hono();
    app.use("*", kvMiddleware(factory));
    app.get("/", (c) => {
      const currentKv = c.get("kv") as IKV & { marker: string };
      return c.json({ marker: currentKv.marker });
    });

    const res = await app.request("/");

    expect(res.status).toBe(200);
    expect(await res.json()).toEqual({ marker: "sync" });
    expect(factory).toHaveBeenCalledTimes(1);
  });

  it("supports async kv factories", async () => {
    const kv = createMockKV("async");
    const factory = vi.fn(async () => kv);

    const app = new Hono();
    app.use("*", kvMiddleware(factory));
    app.get("/", async (c) => {
      const currentKv = c.get("kv") as MockKV;
      await currentKv.set("key", "value");
      return c.json({ marker: currentKv.marker });
    });

    const res = await app.request("/");

    expect(res.status).toBe(200);
    expect(await res.json()).toEqual({ marker: "async" });
    expect(factory).toHaveBeenCalledTimes(1);
    expect(kv.setSpy).toHaveBeenCalledWith("key", "value");
  });
});
