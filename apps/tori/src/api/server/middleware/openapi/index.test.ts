import { uniqueSymbol } from "hono-openapi";
import { describe, expect, it } from "vite-plus/test";
import { z } from "zod";
import { describeRoute } from "./index.js";

describe("describeRoute defaults", () => {
  it("should attach default error response schemas", () => {
    const middleware = describeRoute({
      tags: ["test"],
      summary: "test route",
      response: {
        description: "ok",
        body: z.object({ ok: z.boolean() }),
      },
    });

    const specEntry = (middleware as any)[uniqueSymbol];
    const spec = Array.isArray(specEntry) ? specEntry[0]?.spec : specEntry?.spec;
    expect(spec).toBeDefined();
    for (const status of [401, 403, 404, 409, 429, 500]) {
      const response = spec.responses[status];
      expect(response).toBeDefined();
      expect(response.content?.["application/json"]?.schema).toBeDefined();
    }
  });
});
