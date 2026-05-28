import { Hono } from "hono";
import { z } from "zod";
import { PageBasedPaginationParamSchema } from "@repo/utils/schema/paging";
import { requireAuth } from "@/api/server/middleware/auth.ts";
import { describeRoute } from "@/api/server/middleware/openapi/index.ts";
import {
  integrationStatusResponseDtoSchema,
  proxyInstanceListDtoSchema,
  proxyProbeResponseDtoSchema,
  registerProxyInstanceDtoSchema,
  updateProxyInstanceDtoSchema,
} from "@/api/modules/platform/integration/proxy-instance/contract";
import {
  startTokenProxyConnectionDtoSchema,
  tokenProxyConnectionStartResponseDtoSchema,
} from "@/api/modules/platform/integration/connection/contract.ts";
import {
  deleteProxyInstance,
  probeProxyInstance,
  registerProxyInstance,
  updateProxyInstanceStatus,
} from "./index";
import { startTokenProxyConnection } from "@/api/modules/platform/integration/connection/command.ts";
import type { ProxyInstance } from "@/api/modules/platform/integration/proxy-instance/repository/repository.ts";

const app = new Hono();

app.use("*", requireAuth());

function readProxyProviders(capabilities: unknown) {
  if (!capabilities || typeof capabilities !== "object") return [];
  const providers = (capabilities as { providers?: unknown }).providers;
  if (!Array.isArray(providers)) return [];
  return providers
    .filter((provider): provider is { name?: unknown; flow?: unknown; grantType?: unknown } =>
      Boolean(provider && typeof provider === "object"),
    )
    .map((provider) => ({
      name: typeof provider.name === "string" ? provider.name : "unknown",
      flow: typeof provider.flow === "string" ? provider.flow : "unknown",
      grantType:
        typeof provider.grantType === "string"
          ? provider.grantType
          : typeof (provider as { grant_type?: unknown }).grant_type === "string"
            ? (provider as { grant_type: string }).grant_type
            : "unknown",
    }));
}

function toProxyInstanceDto(proxy: ProxyInstance, currentUserId: string | null, isAdmin: boolean) {
  return {
    ...proxy,
    providers: readProxyProviders(proxy.capabilities),
    canManage: isAdmin || proxy.ownerUserId === currentUserId,
  };
}

app.get(
  "/proxy-instances",
  describeRoute({
    tags: ["Integration"],
    summary: "List proxy instances",
    request: { query: PageBasedPaginationParamSchema },
    response: {
      description: "List of proxy instances",
      body: proxyInstanceListDtoSchema,
    },
  }),
  async (c) => {
    const page = c.req.valid("query");
    const ctx = c.get("serviceContext");
    const result = await ctx.repositories.integration.listVisibleProxyInstances(
      { ownerUserId: ctx.userId!, includeAll: ctx.isAdmin() },
      page,
    );
    return c.json({
      ...result,
      data: result.data.map((proxy) =>
        toProxyInstanceDto(proxy, ctx.userId ?? null, ctx.isAdmin()),
      ),
    });
  },
);

app.post(
  "/proxy-instances/:id/connections/start",
  describeRoute({
    tags: ["Integration"],
    summary: "Start token-proxy connection flow",
    request: {
      param: z.object({ id: z.string() }),
      body: startTokenProxyConnectionDtoSchema,
    },
    response: {
      description: "Token-proxy connection session",
      body: tokenProxyConnectionStartResponseDtoSchema,
    },
  }),
  async (c) => {
    const { id } = c.req.valid("param");
    const body = c.req.valid("json");
    const requestUrl = new URL(c.req.url);
    return c.json(
      await startTokenProxyConnection(c.get("serviceContext"), id, body, requestUrl.origin),
    );
  },
);

app.post(
  "/proxy-instances",
  describeRoute({
    tags: ["Integration"],
    summary: "Register proxy instance",
    request: { body: registerProxyInstanceDtoSchema },
    response: {
      description: "Registered proxy instance",
      body: proxyProbeResponseDtoSchema,
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
      body: proxyProbeResponseDtoSchema,
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
    request: { param: z.object({ id: z.string() }), body: updateProxyInstanceDtoSchema },
    response: {
      description: "Updated proxy instance",
      body: integrationStatusResponseDtoSchema,
    },
  }),
  async (c) => {
    const { id } = c.req.valid("param");
    const body = c.req.valid("json");
    const updated = await updateProxyInstanceStatus(c.get("serviceContext"), id, body.status);
    return c.json({ id: updated.id, status: updated.status });
  },
);

app.delete(
  "/proxy-instances/:id",
  describeRoute({
    tags: ["Integration"],
    summary: "Delete proxy instance",
    request: { param: z.object({ id: z.string() }) },
    response: {
      description: "Deleted proxy instance",
      body: integrationStatusResponseDtoSchema,
    },
  }),
  async (c) => {
    const { id } = c.req.valid("param");
    return c.json(await deleteProxyInstance(c.get("serviceContext"), id));
  },
);

export default app;
