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
  connectionStatusResponseDtoSchema,
  createConnectionDtoSchema,
  tokenProxyConnectionCallbackQuerySchema,
  updateConnectionStatusDtoSchema,
} from "./contract.ts";
import {
  completeTokenProxyConnectionCallback,
  createConnection,
  deleteConnection,
  renderTokenProxyConnectionCallbackPage,
  updateConnectionStatus,
} from "./command.ts";
import { getConnectionAccountProfile } from "@/api/modules/platform/integration/proxy-instance/provider-registry.ts";

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
    const ctx = c.get("serviceContext");
    const items = ctx.isAdmin()
      ? await ctx.repositories.connection.listConnections(page)
      : await ctx.repositories.connection.listConnectionsForOwner(ctx.userId!, page);
    return c.json(items);
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
    const ctx = c.get("serviceContext");
    const items = ctx.isAdmin()
      ? await ctx.repositories.connection.listAccountProfiles(page)
      : await ctx.repositories.connection.listAccountProfilesForOwner(ctx.userId!, page);
    return c.json(items);
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
  "/connections/token-proxy/callback",
  describeRoute({
    tags: ["Connection"],
    summary: "Complete token-proxy connection callback",
    request: { query: tokenProxyConnectionCallbackQuerySchema },
    response: {
      description: "Popup callback HTML",
      body: z.string(),
    },
  }),
  async (c) => {
    const query = c.req.valid("query");
    const result = await completeTokenProxyConnectionCallback(c.get("serviceContext"), {
      sessionId: query.sessionId,
      state: query.state,
      code: query.code,
      error: query.error,
      errorDescription: query.error_description,
    });
    return c.html(renderTokenProxyConnectionCallbackPage(result));
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

app.patch(
  "/connections/:id",
  describeRoute({
    tags: ["Connection"],
    summary: "Update connection status",
    request: {
      param: z.object({ id: z.string() }),
      body: updateConnectionStatusDtoSchema,
    },
    response: {
      description: "Updated connection status",
      body: connectionStatusResponseDtoSchema,
    },
  }),
  async (c) => {
    const { id } = c.req.valid("param");
    const body = c.req.valid("json");
    return c.json(await updateConnectionStatus(c.get("serviceContext"), id, body));
  },
);

app.delete(
  "/connections/:id",
  describeRoute({
    tags: ["Connection"],
    summary: "Delete connection",
    request: { param: z.object({ id: z.string() }) },
    response: {
      description: "Deleted connection",
      body: connectionStatusResponseDtoSchema,
    },
  }),
  async (c) => {
    const { id } = c.req.valid("param");
    return c.json(await deleteConnection(c.get("serviceContext"), id));
  },
);

export default app;
