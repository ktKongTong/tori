import type { Context, Next } from "hono";
import { getCookie } from "hono/cookie";
import { ADMIN_SESSION_COOKIE, verifyAdminSessionCookieValue } from "../admin-session.ts";
import type { Repository } from "../repository/types.ts";
import type { Connection, OAuthClient, ProxyGrant, ProxyPolicy } from "../types.ts";

/**
 * AdminKey authentication.
 * Checks X-Admin-Key header.
 */
export function adminKeyAuth(adminKey: string) {
  return async (c: Context, next: Next) => {
    const key = c.req.header("X-Admin-Key");
    if (!key || key !== adminKey) {
      return c.json({ error: "unauthorized", error_description: "invalid admin key" }, 401);
    }
    await next();
  };
}

declare module "hono" {
  interface ContextVariableMap {
    connection: Connection;
    proxyClient: OAuthClient | null;
    proxyGrant: ProxyGrant | null;
    proxyPolicy: ProxyPolicy | null;
    adminAuthenticated: boolean;
  }
}
/**
 * APIKey authentication.
 * Checks X-API-KEY header, loads connection into context.
 */
export function apiKeyAuth(repo: Repository) {
  return async (c: Context, next: Next) => {
    const apiKey = c.req.header("X-API-KEY");
    if (!apiKey) {
      return c.json({ error: "unauthorized", error_description: "missing X-API-KEY header" }, 401);
    }

    const proxyAuth = await repo.getConnectionForProxyToken(apiKey);
    if (!proxyAuth?.connection) {
      return c.json({ error: "unauthorized", error_description: "invalid API key" }, 401);
    }

    c.set("connection", proxyAuth.connection);
    c.set("proxyClient", proxyAuth.client);
    c.set("proxyGrant", proxyAuth.grant);
    c.set("proxyPolicy", proxyAuth.policy);
    await next();
  };
}

export function connectionPermission(permission: string) {
  return async (c: Context, next: Next) => {
    const conn = c.get("connection") as Connection;
    const permissions = conn.permissions ?? ["proxy", "account"];
    if (!permissions.includes(permission)) {
      return c.json(
        {
          error: "forbidden",
          error_description: `connection lacks permission: ${permission}`,
        },
        403,
      );
    }
    await next();
  };
}

export function adminSessionAuth(secret: string, adminKey: string) {
  return async (c: Context, next: Next) => {
    const cookieValue = getCookie(c, ADMIN_SESSION_COOKIE);
    const ok = await verifyAdminSessionCookieValue(secret, adminKey, cookieValue);
    if (!ok) {
      return c.json({ error: "unauthorized", error_description: "admin session required" }, 401);
    }

    c.set("adminAuthenticated", true);
    await next();
  };
}
