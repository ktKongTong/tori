import { Hono } from "hono";
import { describeRoute } from "@/api/server/middleware/openapi";
import {
  createSubscriptionDtoSchema,
  createSubscriptionResponseDtoSchema,
  subscriptionNotificationEventPageDtoSchema,
  subscriptionStatusResponseDtoSchema,
  subscriptionPageDtoSchema,
  subscriptionViewDtoSchema,
  updateSubscriptionDtoSchema,
} from "@/api/modules/platform/notification/subscription/contract";
import { PageBasedPaginationParamSchema } from "@repo/utils/schema/paging";
import {
  createSubscription,
  updateSubscriptionStatus,
} from "@/api/modules/platform/notification/subscription";
import { requireAuth } from "@/api/server/middleware/auth.ts";
import { z } from "zod";
import {
  mapNotificationEventPage,
  mapSubscriptionPage,
  toSubscriptionDto,
  toSubscriptionViewDto,
} from "@/api/modules/platform/notification/subscription/mapper.ts";

const app = new Hono();

app.use("*", requireAuth());

app.get(
  "/subscription",
  describeRoute({
    tags: ["Subscription"],
    summary: "List subscriptions",
    request: {
      query: PageBasedPaginationParamSchema,
    },
    response: {
      description: "List of subscriptions",
      body: subscriptionPageDtoSchema,
    },
  }),
  async (c) => {
    const page = c.req.valid("query");
    const ctx = c.get("serviceContext");
    const items = ctx.isAdmin()
      ? await ctx.repositories.subscription.listSubscriptions(page)
      : await ctx.repositories.subscription.listSubscriptionsForUser(ctx.userId!, page);
    return c.json(mapSubscriptionPage(items));
  },
);

app.get(
  "/subscription/:id",
  describeRoute({
    tags: ["Subscription"],
    summary: "Get subscription detail",
    request: {
      param: z.object({ id: z.string() }),
    },
    response: {
      description: "Subscription detail",
      body: subscriptionViewDtoSchema,
    },
  }),
  async (c) => {
    const { id } = c.req.valid("param");
    const ctx = c.get("serviceContext");
    const subscription = ctx.isAdmin()
      ? await ctx.repositories.subscription.findSubscriptionById(id)
      : await ctx.repositories.subscription.findSubscriptionByIdForUser(id, ctx.userId!);
    return c.json(toSubscriptionViewDto(subscription));
  },
);

app.get(
  "/subscription/:id/event",
  describeRoute({
    tags: ["Subscription"],
    summary: "Get subscription detail",
    request: {
      param: z.object({ id: z.string() }),
      query: PageBasedPaginationParamSchema,
    },
    response: {
      description: "Subscription notification events",
      body: subscriptionNotificationEventPageDtoSchema,
    },
  }),
  async (c) => {
    const { id } = c.req.valid("param");
    const page = c.req.valid("query");
    const ctx = c.get("serviceContext");

    if (ctx.isAdmin()) {
      await ctx.repositories.subscription.findSubscriptionById(id);
    } else {
      await ctx.repositories.subscription.findSubscriptionByIdForUser(id, ctx.userId!);
    }

    const eventResult = await ctx.repositories.subscription.listNotificationEventBySubscriptionId(
      id,
      page,
    );

    return c.json(mapNotificationEventPage(eventResult));
  },
);

app.post(
  "/subscription",
  describeRoute({
    tags: ["Subscription"],
    summary: "Create subscription",
    request: { body: createSubscriptionDtoSchema },
    response: {
      description: "Created subscription",
      body: createSubscriptionResponseDtoSchema,
    },
  }),
  async (c) => {
    const body = c.req.valid("json");
    const result = await createSubscription(c.get("serviceContext"), body);

    return c.json(
      {
        created: result.created,
        ...toSubscriptionDto(result.subscription),
      },
      201,
    );
  },
);

app.patch(
  "/subscription/:id",
  describeRoute({
    tags: ["Subscription"],
    summary: "Update subscription status",
    request: { param: z.object({ id: z.string() }), body: updateSubscriptionDtoSchema },
    response: {
      description: "Updated subscription",
      body: subscriptionStatusResponseDtoSchema,
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
