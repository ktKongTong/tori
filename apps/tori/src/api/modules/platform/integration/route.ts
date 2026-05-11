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
} from "@/api/modules/platform/integration/contract";
import { NotFoundError } from "@/api/domain/error/index.ts";
import {
  createActionCheckResponse,
  actionCheckRequestSchema,
  actionCheckResponseSchema,
} from "@/api/modules/platform/shared/action-check.ts";
import {
  startTokenProxyConnectionDtoSchema,
  tokenProxyConnectionStartResponseDtoSchema,
} from "@/api/modules/platform/connection/contract.ts";
import {
  deleteProxyInstance,
  probeProxyInstance,
  registerProxyInstance,
  updateProxyInstanceStatus,
} from "./index";
import { startTokenProxyConnection } from "@/api/modules/platform/connection/command.ts";

const app = new Hono();

app.use("*", requireAuth());

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
    return c.json(await c.get("serviceContext").repositories.integration.listProxyInstances(page));
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

app.post(
  "/proxy-instances/:id/action-check",
  describeRoute({
    tags: ["Integration"],
    summary: "Check proxy instance action impact",
    request: {
      param: z.object({ id: z.string() }),
      body: actionCheckRequestSchema,
    },
    response: {
      description: "Proxy action impact",
      body: actionCheckResponseSchema,
    },
  }),
  async (c) => {
    const { id } = c.req.valid("param");
    const { action } = c.req.valid("json");
    const userId = c.get("serviceContext").userId;
    if (!userId) throw new NotFoundError("user not found");
    const proxy = await c.get("serviceContext").repositories.integration.findProxyInstanceForOwner({
      id,
      ownerUserId: userId,
    });
    if (!proxy) throw new NotFoundError("proxy instance not found");

    return c.json(
      createActionCheckResponse({
        resource: {
          type: "proxy_instance",
          id: proxy.id,
          label: proxy.name ?? proxy.baseUrl,
          currentStatus: proxy.status,
        },
        action,
        summary:
          action === "delete"
            ? "This proxy instance will be hidden from normal lists. Existing connection history remains; active connections should be disabled or deleted separately."
            : "This proxy instance will stop new token-proxy flows immediately. Related connections, subscriptions, and tasks are disabled asynchronously.",
        affected: [
          {
            type: "connection",
            action: "async-disable",
            reason: "Active connections using this proxy are disabled by the background worker.",
          },
          {
            type: "subscription",
            action: "async-disable",
            reason: "Subscriptions affected through those connections are disabled asynchronously.",
          },
          {
            type: "task_definition",
            action: "async-disable",
            reason: "Tasks affected through those connections are disabled asynchronously.",
          },
        ],
        retained: [
          { type: "notification_event", action: "retain", reason: "Delivery history is retained." },
          { type: "task_run", action: "retain", reason: "Run history is retained." },
        ],
        internalCleanup:
          action === "delete"
            ? [
                {
                  type: "token_proxy_connection_session",
                  action: "internal-cleanup",
                  reason: "Incomplete connection sessions for this proxy may be removed.",
                },
              ]
            : [],
        runtimeEffects: ["Token-proxy connection start rejects disabled or deleted proxies."],
      }),
    );
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
