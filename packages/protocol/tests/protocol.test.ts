import { describe, expect, it } from "vite-plus/test";
import { dataEnvelope, errorEnvelope } from "../src/http/envelope.ts";
import { errorResponseSchema, rateLimitErrorResponseSchema } from "../src/http/schema.ts";
import { isJsonObject, isJsonValue, type JsonRecord } from "../src/json/index.ts";

describe("JSON protocol primitives", () => {
  it("types json records and detects json values", () => {
    const value: JsonRecord = { ok: true, nested: { count: 1 } };
    expect(isJsonObject(value)).toBe(true);
    expect(isJsonValue(value)).toBe(true);
    expect(isJsonObject(null)).toBe(false);
    expect(isJsonObject([])).toBe(false);
    expect(isJsonValue({ bad: () => undefined })).toBe(false);
  });
});

describe("HTTP protocol envelopes", () => {
  it("creates response envelopes", () => {
    expect(dataEnvelope({ id: "1" })).toEqual({ data: { id: "1" } });
    expect(errorEnvelope("BAD_REQUEST", "Bad request")).toEqual({
      error: { code: "BAD_REQUEST", message: "Bad request" },
    });
    expect(errorEnvelope("BAD_REQUEST", "Bad request", { traceId: "trace-1" })).toEqual({
      error: { code: "BAD_REQUEST", message: "Bad request", traceId: "trace-1" },
    });
  });

  it("validates shared HTTP schemas", () => {
    expect(errorResponseSchema.parse({ code: "BAD_REQUEST", message: "Bad request" })).toEqual({
      code: "BAD_REQUEST",
      message: "Bad request",
    });
    expect(
      rateLimitErrorResponseSchema.safeParse({
        code: "RATE_LIMITED",
        message: "Rate limited",
        detail: { retryAfter: 60 },
      }).success,
    ).toBe(true);
  });
});
