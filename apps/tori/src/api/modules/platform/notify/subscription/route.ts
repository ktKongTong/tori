import {Hono} from "hono";
import {describeRoute} from "@/api/server/middleware/openapi";
import {
  createSubscriptionSchema,
  subscriptionSchema,
  subscriptionViewSchema,
  updateSubscriptionSchema
} from "./schema.ts";
import {PageBasedPaginationParamSchema, PageBasedPaginationResultSchema} from "@repo/utils/schema/paging";
import {createSubscription, updateSubscriptionStatus} from "@/api/modules/platform/notify";
import {requireAdmin} from "@/api/server/middleware/auth.ts";
import {z} from "zod";

const app = new Hono()



app.get(
  "/subscription",
  describeRoute({
    tags: ["Notify"],
    summary: "List subscriptions",
    request: {
      query: PageBasedPaginationParamSchema,
    },
    response: {
      description: "List of subscriptions",
      body: PageBasedPaginationResultSchema(subscriptionViewSchema),
    },
  }),
  async (c) => {
    const items = await c.get("serviceContext").repositories.subscription.listSubscriptions();
    return c.json(items);
  },
);

app.get(
  "/subscription/:id",
  describeRoute({
    tags: ["Notify"],
    summary: "Get subscription detail",
    request: {
      param: z.object({id: z.string()}),
    },
    response: {
      description: "Subscription detail",
      body: subscriptionViewSchema,
    },
  }),
  async (c) => {
    const { id } = c.req.valid("param");
    const subscription = await c.get("serviceContext")
      .repositories
      .subscription.findSubscriptionById(id);
    return c.json(subscription);
  },
);

app.get(
  "/subscription/:id/event",
  describeRoute({
    tags: ["Notify"],
    summary: "Get subscription detail",
    request: {
      param: z.object({id: z.string()}),
      query: PageBasedPaginationParamSchema,
    },
    response: {
      description: "Subscription detail",
      body: PageBasedPaginationResultSchema(subscriptionViewSchema),
    },
  }),
  async (c) => {
    const { id } = c.req.valid("param");
    const page = c.req.valid("query");

    const eventResult = await c.get("serviceContext")
      .repositories
      .subscription.listNotificationEventBySubscriptionId(id);

    return c.json(eventResult);
  },
);



app.post(
  "/subscription",
  describeRoute({
    tags: ["Notify"],
    summary: "Create subscription",
    request: { body: createSubscriptionSchema },
    response: {
      description: "Created subscription",
      body: subscriptionSchema,
    },
  }),
  async (c) => {
    const body = c.req.valid("json");
    const result = await createSubscription(c.get("serviceContext"), body);

    return c.json(
      {
        created: result.created,
        ...result.subscription,
      },
      201,
    );
  },
);

app.patch(
  "/subscription/:id",
  requireAdmin(),
  describeRoute({
    tags: ["Notify"],
    summary: "Update subscription status",
    request: { param: z.object({ id: z.string() }), body: updateSubscriptionSchema },
    response: {
      description: "Updated subscription",
      body: z.object({ id: z.string(), status: z.string() }),
    },
  }),
  async (c) => {
    const { id } = c.req.valid("param");
    const body = c.req.valid("json");
    const updated = await updateSubscriptionStatus(c.get("serviceContext"), id, body.status);
    return c.json({ id: updated.id, status: updated.status });
  },
);

export default app;