import { describe, expect, it } from "vite-plus/test";
import type { ENV } from "@/api/domain/infra/env.ts";
import {
  getTrustedOriginPattern,
  inferOriginURL,
  resolveAuthBaseURL,
  verifyIfTrustedOrigin,
} from "./base-url.js";

const env = (trusted: string): ENV =>
  ({
    BETTER_AUTH_TRUSTED_ORIGIN: trusted,
  }) as ENV;

describe("auth base-url utils", () => {
  describe("inferOriginURL", () => {
    it("prefers origin header", () => {
      const request = new Request("https://api.example.com", {
        headers: {
          origin: "https://fe.example.com",
          "x-forwarded-host": "api.example.com",
          "x-forwarded-proto": "https",
        },
      });

      expect(inferOriginURL(request)).toBe("https://fe.example.com");
    });

    it("falls back to forwarded proto/host", () => {
      const request = new Request("https://api.example.com", {
        headers: {
          "x-forwarded-host": "api.example.com",
          "x-forwarded-proto": "https",
        },
      });

      expect(inferOriginURL(request)).toBe("https://api.example.com");
    });

    it("forces localhost forwarded proto to http", () => {
      const request = new Request("https://api.example.com", {
        headers: {
          "x-forwarded-host": "localhost:3001",
          "x-forwarded-proto": "https",
        },
      });

      expect(inferOriginURL(request)).toBe("http://localhost:3001");
    });

    it("returns undefined when required headers are missing", () => {
      const request = new Request("https://api.example.com");
      expect(inferOriginURL(request)).toBeUndefined();
      expect(inferOriginURL(undefined)).toBeUndefined();
    });
  });

  describe("trusted origin helpers", () => {
    it("parses trusted origin patterns and filters invalid values", () => {
      expect(
        getTrustedOriginPattern(" https://a.example.com,invalid,https://*.example.com "),
      ).toEqual(["https://a.example.com", "https://*.example.com"]);
    });

    it("validates trusted origin by pattern", () => {
      const cfg = env("https://*.example.com,https://fixed.example.org");
      expect(verifyIfTrustedOrigin("https://api.example.com", cfg)).toBe(true);
      expect(verifyIfTrustedOrigin("https://fixed.example.org", cfg)).toBe(true);
      expect(verifyIfTrustedOrigin("https://evil.example.net", cfg)).toBe(false);
      expect(verifyIfTrustedOrigin("not-a-url", cfg)).toBe(false);
    });

    it("resolves auth base url only when inferred origin is trusted", () => {
      const cfg = env("https://fe.example.com");
      const trustedRequest = new Request("https://api.example.com", {
        headers: {
          origin: "https://fe.example.com",
        },
      });
      const untrustedRequest = new Request("https://api.example.com", {
        headers: {
          origin: "https://another.example.com",
        },
      });

      expect(resolveAuthBaseURL(trustedRequest, cfg)).toBe("https://fe.example.com/api/auth");
      expect(resolveAuthBaseURL(untrustedRequest, cfg)).toBeUndefined();
      expect(resolveAuthBaseURL(undefined, cfg)).toBeUndefined();
    });
  });
});
