import { createRequestClient } from "@repo/request";
import type { PageBasedPaginationParam } from "@repo/utils/schema/paging";
import { deliveryEndpointDtoSchema } from "@/api/modules/platform/notify/contract";
import {
  createSubscriptionResponseDtoSchema,
  subscriptionNotificationEventPageDtoSchema,
  subscriptionStatusResponseDtoSchema,
  subscriptionPageDtoSchema,
  subscriptionViewDtoSchema,
  type CreateSubscriptionDto,
} from "@/api/modules/platform/subscription/contract";

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
    schema: deliveryEndpointDtoSchema,
  });

export const listNotifySubscriptions = (
  pagination: PageBasedPaginationParam = { page: 1, pageSize: 100 },
) =>
  notifyRequest.get("/api/notification/subscription", {
    query: pagination,
    schema: subscriptionPageDtoSchema,
  });

export const getSubscriptionDetail = (id: string) =>
  notifyRequest.get(`/api/notification/subscription/${id}`, {
    schema: subscriptionViewDtoSchema,
  });

export const listNotifyEvents = (
  subscriptionId: string,
  pagination: PageBasedPaginationParam = { page: 1, pageSize: 10 },
) =>
  notifyRequest.get(`/api/notification/subscription/${subscriptionId}/event`, {
    query: pagination,
    schema: subscriptionNotificationEventPageDtoSchema,
  });

export const createSubscription = (input: CreateSubscriptionDto) =>
  notifyRequest.post("/api/notification/subscription", input, {
    schema: createSubscriptionResponseDtoSchema,
  });

export const updateSubscriptionStatus = (input: { id: string; status: "active" | "disabled" }) =>
  notifyRequest.patch(
    `/api/notification/subscription/${input.id}`,
    { status: input.status },
    { schema: subscriptionStatusResponseDtoSchema },
  );
