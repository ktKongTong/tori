import { describe, expect, it } from "vite-plus/test";

import { CloudflareKV, type CloudflareKVNamespace } from "../src/cloudflare-kv.ts";

class FakeCloudflareKVNamespace implements CloudflareKVNamespace {
  private values = new Map<string, string>();

  async delete(key: string): Promise<void> {
    this.values.delete(key);
  }

  async get<T = unknown>(key: string, type: "text" | "json"): Promise<T | string | null> {
    const value = this.values.get(key);
    if (!value) return null;
    if (type === "text") return value;
    return JSON.parse(value) as T;
  }

  async put(key: string, value: string): Promise<void> {
    this.values.set(key, value);
  }
}

describe("CloudflareKV", () => {
  it("stores and reads JSON values", async () => {
    const kv = new CloudflareKV(new FakeCloudflareKVNamespace());

    await kv.set("profile", { id: "user-1" });

    await expect(kv.get("profile")).resolves.toEqual({ id: "user-1" });
    await expect(kv.mget("profile", "missing")).resolves.toEqual([{ id: "user-1" }, null]);
  });

  it("increments numeric counters", async () => {
    const kv = new CloudflareKV(new FakeCloudflareKVNamespace());

    await expect(kv.incr("counter")).resolves.toBe(1);
    await expect(kv.incr("counter", 4)).resolves.toBe(5);
    await expect(kv.incr("counter", -10)).resolves.toBe(0);
  });

  it("stores set members without duplicates", async () => {
    const kv = new CloudflareKV(new FakeCloudflareKVNamespace());

    await kv.sadd("members", "a");
    await kv.sadd("members", "a");
    await kv.sadd("members", "b");

    await expect(kv.smembers("members")).resolves.toEqual(["a", "b"]);
  });
});
