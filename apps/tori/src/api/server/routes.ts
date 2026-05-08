import { Scalar } from "@scalar/hono-api-reference";
import { NotFoundError } from "@/api/domain/error/index.ts";
import bindingRoute from "@/api/modules/platform/binding/route.ts";
import botIngressRoute from "@/api/modules/platform/bot-ingress/route.ts";
import botPluginRoute from "@/api/modules/platform/bot-plugin/route.ts";
import connectionRoute from "@/api/modules/platform/connection/route.ts";
import integrationRoute from "@/api/modules/platform/integration/route.ts";
import notifyRoute from "@/api/modules/platform/notify/route.ts";
import subscriptionRoute from "@/api/modules/platform/subscription/route.ts";
import taskRoute from "@/api/modules/platform/task/route.ts";
import { rateLimitMiddleware } from "./middleware/rate-limit.js";
import type { ApiApp } from "./types.js";

export function registerSystemRoutes(app: ApiApp) {
  app.get(
    "/docs",
    Scalar({
      theme: "saturn",
      sources: [
        { url: "/api/openapi.json", title: "Default API" },
        { url: "/api/auth/open-api/generate-schema", title: "Better Auth" },
      ],
    }),
  );

  app.on(
    ["POST", "GET"],
    "/auth/callback/:provider",
    rateLimitMiddleware("auth", { windowSec: 60, maxRequests: 1200 }),
    async (c) => {
      return c.get("auth").handler(c.req.raw);
    },
  );

  app.on(
    ["POST", "GET"],
    "/auth/*",
    rateLimitMiddleware("auth", { windowSec: 60, maxRequests: 1200 }),
    (c) => {
      return c.get("auth").handler(c.req.raw);
    },
  );

  app.get("/health", (c) => c.json({ status: "ok", version: "0.2.0" }));
}

export function registerModuleRoutes(app: ApiApp) {
  app.route("/tasks", taskRoute);
  app.route("/integration", connectionRoute);
  app.route("/integration", integrationRoute);
  app.route("/notification", notifyRoute);
  app.route("/notification", subscriptionRoute);
  app.route("/bot-plugin", botPluginRoute);
  app.route("/bot-ingress", botIngressRoute);
  app.route("/binding", bindingRoute);
}

export function registerFallbackRoutes(app: ApiApp) {
  app.notFound(() => {
    throw new NotFoundError("route not found");
  });
}
