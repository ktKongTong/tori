import { Hono } from "hono";
import { cors } from "hono/cors";
import { logger } from "hono/logger";
import { randomCode } from "@repo/utils/random";
import {
  adminKeyAuth,
  adminSessionAuth,
  apiKeyAuth,
  connectionPermission,
} from "./middleware/auth.ts";
import { createDefaultProviderRegistry, type ProviderRegistry } from "./provider/registry.ts";
import type { Repository } from "./repository/types.ts";
import { adminRoutes } from "./routes/admin.ts";
import { healthRoutes } from "./routes/health.ts";
import { oauthRoutes } from "./routes/oauth.ts";
import { proxyRoutes } from "./routes/proxy.ts";

export interface AppDeps {
  repo: Repository;
  secret: string;
  adminKey?: string;
  registry?: ProviderRegistry;
}

export function createApp(deps: AppDeps) {
  const { repo, secret } = deps;

  const adminKey = deps.adminKey || generateAdminKey();
  if (!deps.adminKey) {
    console.log(`[token-proxy] auto-generated admin key: ${adminKey}`);
  }

  const registry = deps.registry ?? createDefaultProviderRegistry();

  const app = new Hono();

  // Global middleware
  app.use(
    "/admin/*",
    cors({
      origin: (origin) => origin || "",
      credentials: true,
    }),
  );
  app.use("*", logger());

  // ─── Public: health ───
  app.route("/", healthRoutes());

  app.use("/oauth/device/*", adminKeyAuth(adminKey));
  app.use("/oauth/authorize", adminKeyAuth(adminKey));
  app.use("/oauth/providers", adminKeyAuth(adminKey));

  // ─── Public: token, callback ───
  // /oauth/token — client polls with device_code or exchanges auth code
  // /oauth/callback — provider redirects here after OAuth

  // ─── Admin: revoke, introspect ───
  app.use("/oauth/revoke", adminKeyAuth(adminKey));
  app.use("/oauth/introspect", adminKeyAuth(adminKey));

  app.route("/oauth", oauthRoutes({ repo, registry, secret }));

  // ─── Admin Web UI API ───
  app.route("/admin", adminRoutes({ repo, secret, adminKey, registry }));
  app.use("/admin/connections/*", adminSessionAuth(secret, adminKey));
  app.use("/admin/request-logs", adminSessionAuth(secret, adminKey));
  app.use("/admin/auth/session", adminSessionAuth(secret, adminKey));

  // ─── Data plane: proxy (requires X-API-KEY) ───
  app.use("/proxy/*", apiKeyAuth(repo), connectionPermission("proxy"));
  app.route("/proxy", proxyRoutes({ repo, secret }));

  // ─── Data plane: account info (requires X-API-KEY) ───
  app.use("/account", apiKeyAuth(repo), connectionPermission("account"));
  app.get("/account", async (c) => {
    const conn = c.get("connection");
    await repo.updateConnection(conn.id, {
      lastUsedAt: Math.floor(Date.now() / 1000),
      updatedAt: Math.floor(Date.now() / 1000),
    });
    await repo.createRequestLog({
      connectionId: conn.id,
      routeGroup: "account",
      method: "GET",
      statusCode: 200,
      createdAt: Math.floor(Date.now() / 1000),
    });
    return c.json({
      connection_id: conn.id,
      provider: conn.provider,
      provider_uid: conn.providerUid,
      display_name: conn.displayName,
      status: conn.status,
    });
  });

  return app;
}

function generateAdminKey(): string {
  return randomCode("admin", 24);
}
