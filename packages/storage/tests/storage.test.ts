import { describe, expect, it } from "vite-plus/test";
import type { ObjectStore, PutObjectInput } from "../src/object-store.ts";
import { joinObjectKey } from "../src/object-store.ts";
import { getJson, parseJsonLines, putJson, toJsonLines } from "../src/json.ts";

describe("storage", () => {
  it("joins object keys", () => {
    expect(joinObjectKey("/logs/", "svc", undefined, "file.json")).toBe("logs/svc/file.json");
  });

  it("stores json through object store", async () => {
    const store = createMemoryObjectStore();
    await putJson(store, "state.json", { ok: true });
    await expect(getJson(store, "state.json")).resolves.toEqual({ ok: true });
  });

  it("round-trips json lines", () => {
    const lines = toJsonLines([{ id: 1 }, { id: 2 }]);
    expect(parseJsonLines(lines)).toEqual([{ id: 1 }, { id: 2 }]);
  });
});

function createMemoryObjectStore(): ObjectStore {
  const objects = new Map<string, PutObjectInput>();
  return {
    async put(input) {
      objects.set(input.key, input);
    },
    async get(key) {
      const object = objects.get(key);
      if (!object) return undefined;
      const body = typeof object.body === "string" ? new Blob([object.body]).stream() : null;
      return { key, body, contentType: object.contentType, metadata: object.metadata };
    },
    async delete(key) {
      objects.delete(key);
    },
    async list(input = {}) {
      const keys = Array.from(objects.keys()).filter(
        (key) => !input.prefix || key.startsWith(input.prefix),
      );
      return { objects: keys.map((key) => ({ key })) };
    },
  };
}
