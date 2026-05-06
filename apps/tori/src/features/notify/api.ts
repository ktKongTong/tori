import { createRequestClient } from "@repo/request";
import { z } from "zod";

const notifyRequest = createRequestClient({
  credentials: "include",
  retry: 0,
  timeout: 10000,
  headers: {
    accept: "application/json",
  },
});

export const dashboardNotifyEndpointsSchema = z.object({
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

export const dashboardNotifySubscriptionsSchema = z.object({
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

export const dashboardNotifyEventsSchema = z.object({
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

const statusResponseSchema = z.object({
  id: z.string(),
  status: z.string(),
});

const createDeliveryEndpointResponseSchema = z.object({
  id: z.string(),
  platform: z.string(),
  kind: z.string(),
  target: z.string(),
});

const createSubscriptionResponseSchema = z.object({
  id: z.string(),
  channelId: z.string(),
  connectionId: z.string(),
  topicType: z.string(),
  refreshTaskId: z.string().nullish(),
  refreshTaskCreated: z.boolean(),
});

export type DashboardNotifyEndpointsData = z.infer<typeof dashboardNotifyEndpointsSchema>;
export type DashboardNotifySubscriptionsData = z.infer<typeof dashboardNotifySubscriptionsSchema>;
export type DashboardNotifyEventsData = z.infer<typeof dashboardNotifyEventsSchema>;

export type CreateDeliveryEndpointInput = {
  platform: string;
  kind: string;
  target: string;
  displayName: string;
  secret: string;
  config: unknown;
};

export type CreateSubscriptionInput = {
  channelId: string;
  connectionId: string;
  ownerType: string;
  ownerId: string;
  topicType: string;
  topicKey: string;
  eventTypes: string[];
};

export const getNotifyEndpoints = () =>
  notifyRequest.get("/api/dashboard/notify/delivery-endpoints", {
    schema: dashboardNotifyEndpointsSchema,
  });

export const getNotifySubscriptions = () =>
  notifyRequest.get("/api/dashboard/notify/subscriptions", {
    schema: dashboardNotifySubscriptionsSchema,
  });

export const getNotifyEvents = () =>
  notifyRequest.get("/api/dashboard/notify/events", {
    schema: dashboardNotifyEventsSchema,
  });

export const createDeliveryEndpoint = (input: CreateDeliveryEndpointInput) =>
  notifyRequest.post("/api/notify/delivery-endpoints", input, {
    schema: createDeliveryEndpointResponseSchema,
  });

export const updateDeliveryEndpointStatus = (input: {
  id: string;
  status: "active" | "disabled";
}) =>
  notifyRequest.patch(
    `/api/notify/delivery-endpoints/${encodeURIComponent(input.id)}`,
    { status: input.status },
    { schema: statusResponseSchema },
  );

export const createSubscription = (input: CreateSubscriptionInput) =>
  notifyRequest.post("/api/notify/subscriptions", input, {
    schema: createSubscriptionResponseSchema,
  });

export const updateSubscriptionStatus = (input: { id: string; status: "active" | "disabled" }) =>
  notifyRequest.patch(
    `/api/notify/subscriptions/${encodeURIComponent(input.id)}`,
    { status: input.status },
    { schema: statusResponseSchema },
  );
