import { Hono } from "hono";
import { z } from "zod";
import { requireAuth } from "@/api/server/middleware/auth.ts";
import { describeRoute } from "@/api/server/middleware/openapi/index.ts";
import {
  createConnection,
  probeProxyInstance,
  getConnectionAccountProfile,
  refreshConnectionFamily,
  registerProxyInstance,
  updateProxyInstanceStatus,
} from "./index.js";

const app = new Hono();

const proxyProviderResponseSchema = z.object({
  name: z.string(),
  flow: z.string(),
  grantType: z.string(),
});

const createProxyInstanceSchema = z.object({
  baseUrl: z.string().url(),
  credentialRef: z.string().min(1),
  name: z.string().nullable().optional(),
  metadata: z.record(z.string(), z.unknown()).optional(),
});

const updateProxyInstanceSchema = z.object({
  status: z.enum(["active", "disabled"]),
});

const createConnectionSchema = z.object({
  provider: z.string().min(1),
  providerAccountId: z.string().min(1),
  providerAccountName: z.string().nullable().optional(),
  providerAccountAvatar: z.string().nullable().optional(),
  accessMode: z.enum(["public-id", "proxy-token", "mixed"]),
  proxyInstanceId: z.string().nullable().optional(),
  isDefault: z.boolean().optional(),
  metadata: z.record(z.string(), z.unknown()).optional(),
});

const accountProfileResponse = z.object({
  connectionId: z.string(),
  externalAccountId: z.string(),
  displayName: z.string().nullable(),
  avatarUrl: z.string().nullable(),
  profileUrl: z.string().nullable(),
  lastSyncedAt: z.string().nullable(),
  fetchedFromNetwork: z.boolean(),
});

const steamFamilyRefreshResponse = z.object({
  connectionId: z.string(),
  familyId: z.string(),
  librarySize: z.number(),
  syncedAt: z.string(),
  addedCount: z.number(),
  removedCount: z.number(),
});

app.use("*", requireAuth());

app.get(
  "/proxy-instances",
  describeRoute({
    tags: ["Integration"],
    summary: "List proxy instances",
    response: {
      description: "List of proxy instances",
      body: z.object({
        items: z.array(z.unknown()),
      }),
    },
  }),
  async (c) => {
    const items = await c.get("serviceContext").repositories.integration.listProxyInstances();
    return c.json({ items });
  },
);

app.get(
  "/connections",
  describeRoute({
    tags: ["Integration"],
    summary: "List connections",
    response: {
      description: "List of connections",
      body: z.object({
        items: z.array(z.unknown()),
      }),
    },
  }),
  async (c) => {
    const items = await c.get("serviceContext").repositories.integration.listConnections();
    return c.json({ items });
  },
);

app.get(
  "/account-profiles",
  describeRoute({
    tags: ["Integration"],
    summary: "List account profiles",
    response: {
      description: "List of account profiles",
      body: z.object({
        items: z.array(z.unknown()),
      }),
    },
  }),
  async (c) => {
    const items = await c.get("serviceContext").repositories.integration.listAccountProfiles();
    return c.json({ items });
  },
);

app.post(
  "/proxy-instances",
  describeRoute({
    tags: ["Integration"],
    summary: "Register proxy instance",
    request: { body: createProxyInstanceSchema },
    response: {
      description: "Registered proxy instance",
      body: z.object({
        id: z.string(),
        name: z.string().nullable(),
        baseUrl: z.string(),
        healthStatus: z.string(),
        providers: z.array(proxyProviderResponseSchema),
      }),
    },
  }),
  async (c) => {
    const body = c.req.valid("json");
    const result = await registerProxyInstance(c.get("serviceContext"), body);

    return c.json({
      id: result.proxyInstance.id,
      name: result.proxyInstance.name,
      baseUrl: result.proxyInstance.baseUrl,
      healthStatus: result.proxyInstance.healthStatus,
      providers: result.probe.providers,
    });
  },
);

app.post(
  "/proxy-instances/:id/probe",
  describeRoute({
    tags: ["Integration"],
    summary: "Probe proxy instance",
    request: { param: z.object({ id: z.string() }) },
    response: {
      description: "Probed proxy instance",
      body: z.object({
        id: z.string(),
        healthStatus: z.string(),
        providers: z.array(proxyProviderResponseSchema),
      }),
    },
  }),
  async (c) => {
    const { id } = c.req.valid("param");
    const result = await probeProxyInstance(c.get("serviceContext"), id);

    return c.json({
      id: result.proxyInstance.id,
      healthStatus: result.proxyInstance.healthStatus,
      providers: result.probe.providers,
    });
  },
);

app.patch(
  "/proxy-instances/:id",
  describeRoute({
    tags: ["Integration"],
    summary: "Update proxy instance status",
    request: { param: z.object({ id: z.string() }), body: updateProxyInstanceSchema },
    response: {
      description: "Updated proxy instance",
      body: z.object({ id: z.string(), status: z.string() }),
    },
  }),
  async (c) => {
    const { id } = c.req.valid("param");
    const body = c.req.valid("json");
    const updated = await updateProxyInstanceStatus(c.get("serviceContext"), id, body.status);
    return c.json({ id: updated.id, status: updated.status });
  },
);

app.post(
  "/connections",
  describeRoute({
    tags: ["Integration"],
    summary: "Create provider connection",
    request: { body: createConnectionSchema },
    response: {
      description: "Created connection",
      body: z.object({
        id: z.string(),
        ownerUserId: z.string(),
        provider: z.string(),
        providerAccountId: z.string(),
        status: z.string(),
        created: z.boolean(),
      }),
    },
  }),
  async (c) => {
    const body = c.req.valid("json");
    const result = await createConnection(c.get("serviceContext"), body);

    return c.json({
      ...result.connection,
      created: result.created,
    });
  },
);

app.get(
  "/connections/:id/profile",
  describeRoute({
    tags: ["Integration"],
    summary: "Get connection account profile",
    request: { param: z.object({ id: z.string() }) },
    response: {
      description: "Account profile",
      body: accountProfileResponse,
    },
  }),
  async (c) => {
    const { id } = c.req.valid("param");
    return c.json(await getConnectionAccountProfile(c.get("serviceContext"), id));
  },
);

app.post(
  "/connections/:id/family/refresh",
  describeRoute({
    tags: ["Integration"],
    summary: "Refresh steam family members",
    request: { param: z.object({ id: z.string() }) },
    response: {
      description: "Refresh result",
      body: steamFamilyRefreshResponse,
    },
  }),
  async (c) => {
    const { id } = c.req.valid("param");
    return c.json(await refreshConnectionFamily(c.get("serviceContext"), id));
  },
);

export default app;
