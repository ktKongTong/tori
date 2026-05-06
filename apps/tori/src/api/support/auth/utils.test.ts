import { afterEach, beforeEach, describe, expect, it, vi } from "vite-plus/test";

vi.mock("@/support/auth/index.ts", () => ({
  Permissions: {},
}));

import { UnauthorizedError } from "@/api/domain/error/index.ts";
import type { ENV } from "@/api/domain/infra/env.ts";
import {
  isAuthzEnabled,
  requireAuth,
  requirePermission,
  setAuthzEnabled,
  withAuth,
  withPermission,
} from "./utils.js";

const AUTHZ_ENABLED_SYMBOL = Symbol.for("monoark.authz.enabled");

const clearAuthzEnabled = () => {
  delete (globalThis as any)[AUTHZ_ENABLED_SYMBOL];
};

const createContext = (overrides: Record<string, unknown> = {}) =>
  ({
    causationType: "req",
    user: { id: "user-1", role: "user" },
    auth: {
      api: {
        userHasPermission: vi.fn().mockResolvedValue({ success: true }),
      },
    },
    ...overrides,
  }) as any;

describe("support/auth/utils", () => {
  beforeEach(() => {
    clearAuthzEnabled();
    vi.clearAllMocks();
  });

  afterEach(() => {
    clearAuthzEnabled();
  });

  describe("isAuthzEnabled", () => {
    it("uses global switch before env", () => {
      setAuthzEnabled(false);
      const env = { AUTHZ_ENABLED: "true" } as ENV;
      expect(isAuthzEnabled(env)).toBe(false);
    });

    it("falls back to env when global switch is not set", () => {
      const e1 = { AUTHZ_ENABLED: "off" } as ENV;
      expect(isAuthzEnabled(e1)).toBe(false);
      const e2 = { AUTHZ_ENABLED: "on" } as ENV;
      expect(isAuthzEnabled(e2)).toBe(true);
    });

    it("returns true when env reading fails", () => {
      expect(isAuthzEnabled({} as ENV)).toBe(true);
    });
  });

  describe("requireAuth", () => {
    it("throws when authz is enabled and user is missing", () => {
      setAuthzEnabled(true);
      expect(() => requireAuth(undefined as any)).toThrow(UnauthorizedError);
    });

    it("passes when authz is disabled", () => {
      setAuthzEnabled(false);
      expect(() => requireAuth(undefined as any)).not.toThrow();
    });
  });

  describe("requirePermission", () => {
    it("returns early when authz is disabled", async () => {
      setAuthzEnabled(false);
      const ctx = createContext();

      await expect(requirePermission(ctx)).resolves.toBeUndefined();
      expect(ctx.auth.api.userHasPermission).not.toHaveBeenCalled();
    });

    it("allows system context when allowSystem=true and causationType is not req", async () => {
      setAuthzEnabled(true);
      const ctx = createContext({ user: null, auth: null, causationType: "cron" });

      await expect(requirePermission(ctx, { allowSystem: true })).resolves.toBeUndefined();
    });

    it("throws when user/auth is missing", async () => {
      setAuthzEnabled(true);
      await expect(
        requirePermission(createContext({ user: null }), { allowSystem: true }),
      ).rejects.toBeInstanceOf(UnauthorizedError);

      await expect(requirePermission(createContext({ auth: null }))).rejects.toBeInstanceOf(
        UnauthorizedError,
      );
    });

    it("throws when permission check fails", async () => {
      setAuthzEnabled(true);
      const ctx = createContext({
        auth: {
          api: {
            userHasPermission: vi.fn().mockResolvedValue({ success: false }),
          },
        },
      });

      await expect(requirePermission(ctx)).rejects.toBeInstanceOf(UnauthorizedError);
    });

    it("passes and composes permission payload when check succeeds", async () => {
      setAuthzEnabled(true);
      const userHasPermission = vi.fn().mockResolvedValue({ success: true });
      const ctx = createContext({
        user: { id: "admin-1", role: "admin" },
        auth: { api: { userHasPermission } },
      });

      await expect(
        requirePermission(ctx, {
          role: "admin",
          permissions: { comment: ["delete"] } as any,
        }),
      ).resolves.toBeUndefined();

      expect(userHasPermission).toHaveBeenCalledWith({
        body: {
          userId: "admin-1",
          role: "admin",
          permissions: {
            role: ["admin"],
            comment: ["delete"],
          },
        },
      });
    });
  });

  describe("withAuth", () => {
    it("uses this.serviceContext for auth check and keeps handler args", async () => {
      setAuthzEnabled(true);
      const ctx = createContext({ user: null });
      const serviceContext = createContext({ user: { id: "svc-user", role: "user" } });
      const handler = vi.fn().mockResolvedValue("ok");
      const wrapped = withAuth(handler);

      const result = await wrapped.call({ serviceContext }, ctx, "arg-1");

      expect(result).toBe("ok");
      expect(handler).toHaveBeenCalledWith(ctx, "arg-1");
    });

    it("propagates handler error", async () => {
      setAuthzEnabled(true);
      const handlerError = new Error("handler failed");
      const wrapped = withAuth(async () => {
        throw handlerError;
      });

      await expect(wrapped(createContext())).rejects.toThrow("handler failed");
    });
  });

  describe("withPermission", () => {
    it("checks permission by this.serviceContext and runs handler on success", async () => {
      setAuthzEnabled(true);
      const userHasPermission = vi.fn().mockResolvedValue({ success: true });
      const ctx = createContext({ user: null, auth: null });
      const serviceContext = createContext({
        user: { id: "svc-admin", role: "admin" },
        auth: { api: { userHasPermission } },
      });
      const handler = vi.fn().mockResolvedValue("done");
      const wrapped = withPermission({ role: "admin" })(handler);

      const result = await wrapped.call({ serviceContext }, ctx, "x");

      expect(result).toBe("done");
      expect(userHasPermission).toHaveBeenCalledTimes(1);
      expect(handler).toHaveBeenCalledWith(ctx, "x");
    });

    it("throws and does not run handler when permission is denied", async () => {
      setAuthzEnabled(true);
      const ctx = createContext({
        auth: {
          api: {
            userHasPermission: vi.fn().mockResolvedValue({ success: false }),
          },
        },
      });
      const handler = vi.fn();
      const wrapped = withPermission()(handler);

      await expect(wrapped(ctx)).rejects.toBeInstanceOf(UnauthorizedError);
      expect(handler).not.toHaveBeenCalled();
    });
  });
});
