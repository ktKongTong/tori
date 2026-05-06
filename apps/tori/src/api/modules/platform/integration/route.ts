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
  resolveConnectionAccess,
  updateProxyInstanceStatus,
} from "./index.js";

const app = new Hono();

const createProxyInstanceSchema = z.object({
  baseUrl: z.string().url(),
  credentialRef: z.string().min(1),
  name: z.string().nullable().optional(),
  metadata: z.record(z.string(), z.any()).optional(),
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
  metadata: z.record(z.string(), z.any()).optional(),
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

app.post(
  "/proxy-instances",
  describeRoute({
    tags: ["Integration"],
    summary: "Register proxy instance",
    request: { body: createProxyInstanceSchema },
    response: {
      description: "Proxy instance created or reused",
      body: z.object({
        id: z.string(),
        ownerUserId: z.string(),
        provider: z.string(),
        baseUrl: z.string(),
        name: z.string().nullable(),
        status: z.string(),
        healthStatus: z.string(),
        providers: z.array(
          z.object({
            name: z.string(),
            flow: z.string(),
            grantType: z.string(),
          }),
        ),
        created: z.boolean(),
      }),
    },
  }),
  async (c) => {
    const body = c.req.valid("json");
    const result = await registerProxyInstance(c.get("serviceContext"), body);

    return c.json(
      {
        id: result.proxyInstance.id,
        ownerUserId: result.proxyInstance.ownerUserId,
        provider: result.proxyInstance.provider,
        baseUrl: result.proxyInstance.baseUrl,
        name: result.proxyInstance.name ?? null,
        status: result.proxyInstance.status,
        healthStatus: result.proxyInstance.healthStatus,
        providers: result.probe.providers,
        created: result.created,
      },
      201,
    );
  },
);

app.post(
  "/proxy-instances/:id/probe",
  describeRoute({
    tags: ["Integration"],
    summary: "Probe token-proxy capabilities",
    request: { param: z.object({ id: z.string() }) },
    response: {
      description: "Proxy probe result",
      body: z.object({
        id: z.string(),
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
    },
  }),
  async (c) => {
    const { id } = c.req.valid("param");
    const result = await probeProxyInstance(c.get("serviceContext"), id);
    return c.json({
      id: result.proxyInstance.id,
      status: result.proxyInstance.status,
      healthStatus: result.proxyInstance.healthStatus,
      providers: result.probe.providers,
    });
  },
);

app.patch(
  "/proxy-instances/:id",
  describeRoute({
    tags: ["Integration"],
    summary: "Update token-proxy status",
    request: { param: z.object({ id: z.string() }), body: updateProxyInstanceSchema },
    response: {
      description: "Updated proxy instance",
      body: z.object({
        id: z.string(),
        status: z.string(),
      }),
    },
  }),
  async (c) => {
    const { id } = c.req.valid("param");
    const body = c.req.valid("json");
    const result = await updateProxyInstanceStatus(c.get("serviceContext"), id, body.status);
    return c.json({
      id: result.id,
      status: result.status,
    });
  },
);

app.post(
  "/connections",
  describeRoute({
    tags: ["Integration"],
    summary: "Create provider connection",
    request: { body: createConnectionSchema },
    response: {
      description: "Connection created or reused",
      body: z.object({
        id: z.string(),
        ownerUserId: z.string(),
        provider: z.string(),
        providerAccountId: z.string(),
        providerAccountName: z.string().nullable(),
        providerAccountAvatar: z.string().nullable(),
        accessMode: z.enum(["public-id", "proxy-token", "mixed"]),
        proxyInstanceId: z.string().nullable(),
        isDefault: z.boolean(),
        status: z.string(),
        created: z.boolean(),
      }),
    },
  }),
  async (c) => {
    const body = c.req.valid("json");
    const result = await createConnection(c.get("serviceContext"), body);

    return c.json(
      {
        id: result.connection.id,
        ownerUserId: result.connection.ownerUserId,
        provider: result.connection.provider,
        providerAccountId: result.connection.providerAccountId,
        providerAccountName: result.connection.providerAccountName ?? null,
        providerAccountAvatar: result.connection.providerAccountAvatar ?? null,
        accessMode: result.connection.accessMode as "public-id" | "proxy-token" | "mixed",
        proxyInstanceId: result.connection.proxyInstanceId ?? null,
        isDefault: result.connection.isDefault,
        status: result.connection.status,
        created: result.created,
      },
      201,
    );
  },
);

app.get(
  "/connections/:id/access",
  describeRoute({
    tags: ["Integration"],
    summary: "Resolve connection access",
    request: { param: z.object({ id: z.string() }) },
    response: {
      description: "Connection access mode",
      body: z.object({
        connectionId: z.string(),
        accessMode: z.enum(["public-id", "proxy-token", "mixed"]),
        requiresProxy: z.boolean(),
        supportsPublicAccess: z.boolean(),
        proxyInstanceId: z.string().nullable(),
      }),
    },
  }),
  async (c) => {
    const { id } = c.req.valid("param");
    const result = await resolveConnectionAccess(c.get("serviceContext"), id);

    return c.json({
      connectionId: result.connection.id,
      accessMode: result.connection.accessMode as "public-id" | "proxy-token" | "mixed",
      requiresProxy: result.requiresProxy,
      supportsPublicAccess: result.supportsPublicAccess,
      proxyInstanceId: result.proxyInstanceId,
    });
  },
);

app.get(
  "/connections/:id/account-profile",
  describeRoute({
    tags: ["Integration"],
    summary: "Fetch provider account profile for one connection",
    request: { param: z.object({ id: z.string() }) },
    response: {
      description: "Provider account profile",
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
    summary: "Refresh Steam Family snapshot for one connection",
    request: { param: z.object({ id: z.string() }) },
    response: {
      description: "Refreshed steam family snapshot",
      body: steamFamilyRefreshResponse,
    },
  }),
  async (c) => {
    const { id } = c.req.valid("param");
    return c.json(await refreshConnectionFamily(c.get("serviceContext"), id));
  },
);

export default app;
