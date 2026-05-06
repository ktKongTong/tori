import { describe, expect, it } from "vite-plus/test";
import { z } from "zod";

import { RequestError, createRequestClient } from "../src/index.ts";

const userSchema = z.object({
  id: z.string(),
});

function jsonResponse(value: unknown, init?: ResponseInit) {
  const headers = new Headers(init?.headers);
  headers.set("content-type", "application/json");

  return new Response(JSON.stringify(value), {
    ...init,
    headers,
  });
}

describe("request client", () => {
  it("parses get json through a zod schema", async () => {
    const client = createRequestClient({
      fetch: async (request, options) => {
        expect(request).toBe("/users/me");
        expect(options?.method).toBe("GET");
        return jsonResponse({ id: "user-1" });
      },
    });

    await expect(client.get("/users/me", { schema: userSchema })).resolves.toEqual({
      id: "user-1",
    });
  });

  it("posts json body through a zod schema", async () => {
    const client = createRequestClient({
      fetch: async (_request, options) => {
        expect(options?.method).toBe("POST");
        expect(options?.body).toBe(JSON.stringify({ name: "Ada" }));
        return jsonResponse({ id: "user-2" });
      },
    });

    await expect(client.post("/users", { name: "Ada" }, { schema: userSchema })).resolves.toEqual({
      id: "user-2",
    });
  });

  it("returns better-result errors when requested", async () => {
    const client = createRequestClient({
      fetch: async () => jsonResponse({ id: 123 }),
    });

    const result = await client.get("/users/me", {
      as: "result",
      schema: userSchema,
    });

    expect(result.isErr()).toBe(true);
    expect(result.unwrapOr(null)).toBe(null);
  });

  it("normalizes http errors", async () => {
    const client = createRequestClient({
      fetch: async () => jsonResponse({ message: "nope" }, { status: 403 }),
    });

    const result = await client.result("/admin");

    expect(result.isErr()).toBe(true);
    if (result.isErr()) {
      expect(result.error).toBeInstanceOf(RequestError);
      expect(result.error.status).toBe(403);
      expect(result.error.message).toBe("nope");
    }
  });
});
