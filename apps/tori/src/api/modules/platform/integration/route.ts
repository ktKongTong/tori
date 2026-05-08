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
import { probeProxyInstance, registerProxyInstance, updateProxyInstanceStatus } from "./index";

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

export default app;
