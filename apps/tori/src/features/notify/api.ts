import { createRequestClient } from "@repo/request";
import { z } from "zod";
import {notifyEventsSchema} from "@/api/modules/platform/notify/schema/notification.ts";
import { deliveryEndpointSchema } from "@/api/modules/platform/notify/schema/endpoint.ts";
import {
  createSubscriptionResponseSchema,
  subscriptionViewSchema,
} from "@/api/modules/platform/notify/subscription/schema.ts";
import type {CreateSubscriptionInput} from "@/api/modules/platform/notify";
import {PageBasedPaginationResultSchema} from "@repo/utils/schema/paging";

const notifyRequest = createRequestClient({
  credentials: "include",
  retry: 0,
  timeout: 10000,
  headers: {
    accept: "application/json",
  },
});


export const listDeliveryEndpoints = () =>
  notifyRequest.get("/api/notify/delivery-endpoints", {
    schema: deliveryEndpointSchema,
  });

export const listNotifySubscriptions = () =>
  notifyRequest.get("/api/notification/subscription", {
    schema: PageBasedPaginationResultSchema(subscriptionViewSchema),
  });


export const getSubscriptionDetail = (
  id: string,
) =>
  notifyRequest.get(`/api/notification/subscription/${id}`, {
    schema: subscriptionViewSchema,
  });

export const listNotifyEvents = (subscriptionId: string) =>
  notifyRequest.get(`/api/notification/subscription/${subscriptionId}/event`, {
    schema: PageBasedPaginationResultSchema(notifyEventsSchema),
  });


export const createSubscription = (input: CreateSubscriptionInput) =>
  notifyRequest.post("/api/notification/subscription", input, {
    schema: createSubscriptionResponseSchema,
  });

export const updateSubscriptionStatus = (input: { id: string; status: "active" | "disabled" }) =>
  notifyRequest.patch(
    `/api/notification/subscription/${input.id}`,
    { status: input.status },
    { schema: z.unknown() },
  );