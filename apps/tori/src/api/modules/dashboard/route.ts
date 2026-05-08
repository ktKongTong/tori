import { Hono } from "hono";
import { z } from "zod";
import { requireAuth } from "@/api/server/middleware/auth";
import { describeRoute } from "@/api/server/middleware/openapi";

const app = new Hono();

const overviewSchema = z.object({
  generatedAt: z.string(),
  routeInventory: z.array(
    z.object({
      group: z.string(),
      path: z.string(),
      status: z.enum(["ready", "planned"]),
      note: z.string(),
    }),
  ),
  readiness: z.array(
    z.object({
      system: z.string(),
      status: z.enum(["ready", "planned", "in-progress"]),
      note: z.string(),
    }),
  ),
});

const DEMO = {
  generatedAt: "2026-04-11T00:00:00.000Z",
  routeInventory: [
    {
      group: "bot",
      path: "/api/bot-ingress/request",
      status: "ready" as const,
      note: "External bot ingress request",
    },
    {
      group: "binding",
      path: "/api/binding/*",
      status: "ready" as const,
      note: "Binding issuance and claim redeem",
    },
    {
      group: "integration",
      path: "/api/integration/*",
      status: "ready" as const,
      note: "Proxy, capabilities, provider connection",
    },
    {
      group: "notify",
      path: "/api/notify/*",
      status: "ready" as const,
      note: "Delivery endpoint, subscription, notification dispatch",
    },
    {
      group: "bot-admin",
      path: "/api/bot-plugin/instances/*",
      status: "ready" as const,
      note: "Admin-only managed bot plugin CRUD",
    },
  ],
  readiness: [
    { system: "api-v2", status: "in-progress" as const, note: "Main runtime moved to api-v2" },
    { system: "steam", status: "ready" as const, note: "Steam module mounted" },
  ],
  bot: { pluginSurfaces: [], recentIngresses: [], pendingHandshakes: [] },
};

app.use("*", requireAuth());

app.get(
  "/demo/overview",
  describeRoute({
    tags: ["Dashboard"],
    summary: "Overview demo payload",
    response: { description: "overview", body: overviewSchema },
  }),
  (c) =>
    c.json({
      generatedAt: DEMO.generatedAt,
      routeInventory: DEMO.routeInventory,
      readiness: DEMO.readiness,
    }),
);

app.get(
  "/demo/bot",
  describeRoute({
    tags: ["Dashboard"],
    summary: "Bot demo payload",
    response: {
      description: "bot",
      body: z.object({
        pluginSurfaces: z.array(z.unknown()),
        recentIngresses: z.array(z.unknown()),
        pendingHandshakes: z.array(z.unknown()),
      }),
    },
  }),
  (c) => c.json(DEMO.bot),
);

export default app;
