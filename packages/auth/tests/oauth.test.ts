import { describe, expect, it } from "vite-plus/test";
import { oauthErrorEnvelope } from "../src/oauth/envelope.ts";
import { deviceAuthorizeSchema, oauthProxyHeadersSchema } from "../src/oauth/schema.ts";

describe("OAuth foundations", () => {
  it("validates OAuth request schemas", () => {
    expect(deviceAuthorizeSchema.parse({ provider: "steam" })).toEqual({ provider: "steam" });
    expect(
      oauthProxyHeadersSchema.safeParse({
        "x-api-key": "key",
        "x-proxy-url": "https://example.com/path",
      }).success,
    ).toBe(true);
  });

  it("creates OAuth error envelopes", () => {
    expect(oauthErrorEnvelope("invalid_request")).toEqual({ error: "invalid_request" });
    expect(oauthErrorEnvelope("invalid_request", "missing field")).toEqual({
      error: "invalid_request",
      error_description: "missing field",
    });
  });
});
