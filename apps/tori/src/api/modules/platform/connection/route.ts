import { Hono } from "hono";
import { z } from "zod";
import { PageBasedPaginationParamSchema } from "@repo/utils/schema/paging";
import { requireAuth } from "@/api/server/middleware/auth.ts";
import { describeRoute } from "@/api/server/middleware/openapi/index.ts";
import {
  accountProfileListDtoSchema,
  accountProfileResponseDtoSchema,
  connectionCreatedDtoSchema,
  connectionListDtoSchema,
  createConnectionDtoSchema,
  steamFamilyRefreshResponseDtoSchema,
} from "./contract.ts";
import { createConnection } from "./command.ts";
import {
  getConnectionAccountProfile,
  refreshConnectionFamily,
} from "@/api/modules/platform/integration/provider-registry.ts";

const app = new Hono();

app.use("*", requireAuth());

app.get(
  "/connections",
  describeRoute({
    tags: ["Connection"],
    summary: "List connections",
    request: { query: PageBasedPaginationParamSchema },
    response: {
      description: "List of connections",
      body: connectionListDtoSchema,
    },
  }),
  async (c) => {
    const page = c.req.valid("query");
    return c.json(await c.get("serviceContext").repositories.connection.listConnections(page));
  },
);

app.get(
  "/account-profiles",
  describeRoute({
    tags: ["Connection"],
    summary: "List account profiles",
    request: { query: PageBasedPaginationParamSchema },
    response: {
      description: "List account profiles",
      body: accountProfileListDtoSchema,
    },
  }),
  async (c) => {
    const page = c.req.valid("query");
    return c.json(await c.get("serviceContext").repositories.connection.listAccountProfiles(page));
  },
);

app.post(
  "/connections",
  describeRoute({
    tags: ["Connection"],
    summary: "Create provider connection",
    request: { body: createConnectionDtoSchema },
    response: {
      description: "Created connection",
      body: connectionCreatedDtoSchema,
    },
  }),
  async (c) => {
    const body = c.req.valid("json");
    const result = await createConnection(c.get("serviceContext"), body);

    return c.json(result);
  },
);

app.get(
  "/connections/:id/profile",
  describeRoute({
    tags: ["Connection"],
    summary: "Get connection account profile",
    request: { param: z.object({ id: z.string() }) },
    response: {
      description: "Account profile",
      body: accountProfileResponseDtoSchema,
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
    tags: ["Connection"],
    summary: "Refresh steam family members",
    request: { param: z.object({ id: z.string() }) },
    response: {
      description: "Refresh result",
      body: steamFamilyRefreshResponseDtoSchema,
    },
  }),
  async (c) => {
    const { id } = c.req.valid("param");
    return c.json(await refreshConnectionFamily(c.get("serviceContext"), id));
  },
);

export default app;
