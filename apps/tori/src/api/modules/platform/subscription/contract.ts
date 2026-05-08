import { PageBasedPaginationResultSchema } from "@repo/utils/schema/paging";
import { z } from "zod";
import { notificationEventDtoSchema } from "@/api/modules/platform/notify/contract";

export const userSummaryDtoSchema = z.object({
  id: z.string(),
  name: z.string(),
});

export const channelSummaryDtoSchema = z.object({
  id: z.string(),
  name: z.string().nullable(),
});

export const connectionSummaryDtoSchema = z.object({
  id: z.string(),
  provider: z.string(),
  providerAccountName: z.string().nullable(),
});

export const botInstanceSummaryDtoSchema = z.object({
  id: z.string(),
  displayName: z.string().nullable(),
});

export const subscriptionDtoSchema = z.object({
  id: z.string(),
  channelId: z.string(),
  botPluginInstanceId: z.string().nullable(),
  connectionId: z.string(),
  ownerType: z.string(),
  ownerId: z.string(),
  topicType: z.string(),
  topicKey: z.string(),
  eventTypes: z.array(z.string()),
  status: z.string(),
  filterExpr: z.unknown().nullable(),
  createdByUserId: z.string().nullable(),
  createdAt: z.string(),
  updatedAt: z.string(),
});

export const subscriptionViewDtoSchema = subscriptionDtoSchema.extend({
  channel: channelSummaryDtoSchema.nullable(),
  connection: connectionSummaryDtoSchema.nullable(),
  botInstance: botInstanceSummaryDtoSchema.nullable(),
  owner: userSummaryDtoSchema.nullable(),
  ownerChannel: channelSummaryDtoSchema.nullable(),
});

export const createSubscriptionDtoSchema = z.object({
  channelId: z.string().min(1),
  botPluginInstanceId: z.string().optional(),
  connectionId: z.string().min(1),
  ownerType: z.enum(["USER", "CHANNEL"]),
  ownerId: z.string().optional(),
  topicType: z.string().min(1),
  topicKey: z.string().min(1),
  eventTypes: z.array(z.string().min(1)).min(1),
  filterExpr: z.record(z.string(), z.unknown()).optional(),
});

export const createSubscriptionResponseDtoSchema = subscriptionDtoSchema.extend({
  created: z.boolean(),
});

export const updateSubscriptionDtoSchema = z.object({
  status: z.enum(["active", "disabled"]),
});

export const subscriptionStatusResponseDtoSchema = z.object({
  id: z.string(),
  status: z.string(),
});

export const subscriptionPageDtoSchema = PageBasedPaginationResultSchema(subscriptionViewDtoSchema);
export const subscriptionNotificationEventPageDtoSchema = PageBasedPaginationResultSchema(
  notificationEventDtoSchema,
);

export type SubscriptionDto = z.infer<typeof subscriptionDtoSchema>;
export type SubscriptionViewDto = z.infer<typeof subscriptionViewDtoSchema>;
export type CreateSubscriptionDto = z.infer<typeof createSubscriptionDtoSchema>;
export type CreateSubscriptionResponseDto = z.infer<typeof createSubscriptionResponseDtoSchema>;
export type UpdateSubscriptionDto = z.infer<typeof updateSubscriptionDtoSchema>;
export type SubscriptionStatusResponseDto = z.infer<typeof subscriptionStatusResponseDtoSchema>;
