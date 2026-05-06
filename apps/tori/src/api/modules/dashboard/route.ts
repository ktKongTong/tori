import { Hono } from "hono";
import { z } from "zod";
import { requireAdmin, requireAuth } from "@/api/server/middleware/auth";
import { describeRoute } from "@/api/server/middleware/openapi";
import {
  getDashboardBinding,
  getDashboardBotInstances,
  getDashboardIntegration,
  getDashboardNotify,
  getDashboardNotifyDeliveryEndpoints,
  getDashboardNotifyEvents,
  getDashboardNotifySubscriptions,
  getDashboardTasks,
} from "./query";
import { getDashboardRepository } from "./repository";

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

const bindingSchema = z.object({
  userBindings: z.array(
    z.object({
      id: z.string(),
      userId: z.string(),
      userName: z.string(),
      platform: z.string(),
      externalUserId: z.string(),
      externalUserName: z.string(),
      assurance: z.string(),
    }),
  ),
  channelBindings: z.array(
    z.object({
      id: z.string(),
      channelId: z.string(),
      channelName: z.string(),
      platform: z.string(),
      externalChannelId: z.string(),
      externalChannelName: z.string(),
      botPluginInstanceId: z.string().nullable(),
      botInstanceName: z.string(),
    }),
  ),
  claimSessions: z.array(
    z.object({
      id: z.string(),
      purpose: z.string(),
      status: z.string(),
      anonymousUserId: z.string().nullable(),
      anonymousUserName: z.string(),
      platform: z.string(),
      observedUserId: z.string().nullable(),
      observedUserName: z.string(),
      observedChannelId: z.string().nullable(),
      observedChannelName: z.string(),
    }),
  ),
});

const integrationSchema = z.object({
  proxyInstances: z.array(
    z.object({
      id: z.string(),
      ownerUserId: z.string(),
      name: z.string(),
      provider: z.string(),
      baseUrl: z.string(),
      status: z.string(),
      healthStatus: z.string(),
      providers: z.array(
        z.object({
          name: z.string(),
          flow: z.string(),
          grantType: z.string(),
        }),
      ),
    }),
  ),
  connections: z.array(
    z.object({
      id: z.string(),
      ownerUserId: z.string(),
      provider: z.string(),
      providerAccountName: z.string().nullable(),
      accountLabel: z.string(),
      providerAccountId: z.string(),
      accessMode: z.string(),
      proxyInstanceId: z.string().nullable(),
      proxyName: z.string().nullable(),
      isDefault: z.boolean(),
      status: z.string(),
      accountProfile: z
        .object({
          externalAccountId: z.string(),
          displayName: z.string().nullable(),
          avatarUrl: z.string().nullable(),
          profileUrl: z.string().nullable(),
          lastSyncedAt: z.string().nullable(),
        })
        .nullable(),
    }),
  ),
});

const botInstancesSchema = z.object({
  instances: z.array(
    z.object({
      id: z.string(),
      ownerUserId: z.string(),
      platform: z.string(),
      namespace: z.string(),
      instanceKey: z.string(),
      displayName: z.string(),
      callbackMode: z.string(),
      deliveryEndpointId: z.string().nullable(),
      deliveryEndpointLabel: z.string().nullable(),
      status: z.string(),
      lastSeenAt: z.string().nullable(),
    }),
  ),
  deliveryEndpoints: z.array(
    z.object({
      id: z.string(),
      platform: z.string(),
      kind: z.string(),
      displayName: z.string(),
      target: z.string(),
      status: z.string(),
    }),
  ),
});

const notifyDeliveryEndpointsSchema = z.object({
  deliveryEndpoints: z.array(
    z.object({
      id: z.string(),
      platform: z.string(),
      kind: z.string(),
      displayName: z.string(),
      target: z.string(),
      status: z.string(),
    }),
  ),
});

const notifySubscriptionsSchema = z.object({
  subscriptions: z.array(
    z.object({
      id: z.string(),
      channelId: z.string(),
      channelLabel: z.string(),
      botPluginInstanceId: z.string(),
      botPluginInstanceLabel: z.string(),
      connectionId: z.string(),
      connectionLabel: z.string(),
      ownerType: z.string(),
      ownerId: z.string(),
      ownerLabel: z.string(),
      topicType: z.string(),
      topicKey: z.string(),
      status: z.string(),
    }),
  ),
});

const notifyEventsSchema = z.object({
  notificationEvents: z.array(
    z.object({
      id: z.string(),
      subscriptionId: z.string().nullable(),
      subscriptionLabel: z.string().nullable(),
      channelId: z.string(),
      channelLabel: z.string(),
      botPluginInstanceId: z.string().nullable(),
      botPluginInstanceLabel: z.string().nullable(),
      deliveryEndpointId: z.string().nullable(),
      deliveryEndpointLabel: z.string().nullable(),
      title: z.string().nullable(),
      status: z.string(),
      createdAt: z.string(),
    }),
  ),
});

const tasksSchema = z.object({
  tasks: z.array(
    z.object({
      id: z.string(),
      kind: z.string(),
      schedule: z.string(),
      enabled: z.boolean(),
      connectionId: z.string().nullable(),
      connectionLabel: z.string().nullable(),
      lastRunStatus: z.string().nullable(),
    }),
  ),
});

const notifySchema = notifyDeliveryEndpointsSchema
  .merge(notifySubscriptionsSchema)
  .merge(notifyEventsSchema);

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
  "/binding",
  describeRoute({
    tags: ["Dashboard"],
    summary: "Live binding payload",
    response: { description: "binding payload", body: bindingSchema },
  }),
  async (c) => c.json(await getDashboardBinding(getDashboardRepository(c.get("serviceContext")))),
);

app.get(
  "/integration",
  describeRoute({
    tags: ["Dashboard"],
    summary: "Live integration payload",
    response: { description: "integration payload", body: integrationSchema },
  }),
  async (c) =>
    c.json(await getDashboardIntegration(getDashboardRepository(c.get("serviceContext")))),
);

app.get(
  "/notify",
  describeRoute({
    tags: ["Dashboard"],
    summary: "Live notify payload",
    response: { description: "notify payload", body: notifySchema },
  }),
  async (c) =>
    c.json(
      await getDashboardNotify(
        getDashboardRepository(c.get("serviceContext")),
        c.get("serviceContext").isAdmin(),
      ),
    ),
);

app.get(
  "/notify/subscriptions",
  describeRoute({
    tags: ["Dashboard"],
    summary: "Dashboard notify subscriptions payload",
    response: { description: "notify subscriptions", body: notifySubscriptionsSchema },
  }),
  async (c) =>
    c.json(await getDashboardNotifySubscriptions(getDashboardRepository(c.get("serviceContext")))),
);
app.get(
  "/notify/events",
  describeRoute({
    tags: ["Dashboard"],
    summary: "Dashboard notify events payload",
    response: { description: "notify events", body: notifyEventsSchema },
  }),
  async (c) =>
    c.json(
      await getDashboardNotifyEvents(
        getDashboardRepository(c.get("serviceContext")),
        c.get("serviceContext").isAdmin(),
      ),
    ),
);
app.get(
  "/notify/delivery-endpoints",
  requireAdmin(),
  describeRoute({
    tags: ["Dashboard"],
    summary: "Dashboard notify delivery endpoints payload",
    response: { description: "notify delivery endpoints", body: notifyDeliveryEndpointsSchema },
  }),
  async (c) =>
    c.json(
      await getDashboardNotifyDeliveryEndpoints(
        getDashboardRepository(c.get("serviceContext")),
        c.get("serviceContext").isAdmin(),
      ),
    ),
);
app.get(
  "/tasks",
  requireAdmin(),
  describeRoute({
    tags: ["Dashboard"],
    summary: "Dashboard tasks payload",
    response: { description: "tasks", body: tasksSchema },
  }),
  async (c) =>
    c.json(
      await getDashboardTasks(
        getDashboardRepository(c.get("serviceContext")),
        c.get("serviceContext").isAdmin(),
      ),
    ),
);
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
        pluginSurfaces: z.array(z.any()),
        recentIngresses: z.array(z.any()),
        pendingHandshakes: z.array(z.any()),
      }),
    },
  }),
  (c) => c.json(DEMO.bot),
);

app.get(
  "/bot-instances",
  requireAdmin(),
  describeRoute({
    tags: ["Dashboard"],
    summary: "Admin bot instance payload",
    response: { description: "bot instance payload", body: botInstancesSchema },
  }),
  async (c) =>
    c.json(await getDashboardBotInstances(getDashboardRepository(c.get("serviceContext")))),
);

export default app;
