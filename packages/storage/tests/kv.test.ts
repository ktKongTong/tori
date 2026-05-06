import { describe, expect, it } from "vite-plus/test";
import { MemoryKV, NoopKV } from "../src/kv.ts";

describe("KV implementations", () => {
  it("stores memory values and set members", async () => {
    const kv = new MemoryKV();

    await kv.set("key", { ok: true });
    await kv.sadd("set", "a");
    await kv.sadd("set", "b");

    expect(await kv.get("key")).toEqual({ ok: true });
    expect(await kv.incr("count")).toBe(1);
    expect(await kv.smembers("set")).toEqual(["a", "b"]);
    expect(await kv.mget("key", "missing")).toEqual([{ ok: true }, null]);
  });

  it("keeps noop semantics stable", async () => {
    const kv = new NoopKV();

    expect(await kv.set("key", "value")).toBe("OK");
    expect(await kv.get("key")).toBeNull();
    expect(await kv.incr("count")).toBe(0);
    expect(await kv.smembers("set")).toEqual([]);
    expect(await kv.mget("a", "b")).toEqual([null, null]);
  });
});
