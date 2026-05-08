import { z } from "zod";

export const subscriptionSchema = z.object({
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
  createdAt: z.coerce.date(),
  updatedAt: z.coerce.date(),
});

export const subscriptionViewSchema = subscriptionSchema.extend({
  channel: z.unknown().nullable(),
  connection: z.unknown().nullable(),
  owner: z.unknown(),
  // ownerChannel: channelSummarySchema.nullable(),
});

export const createSubscriptionSchema = z.object({
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



export const createSubscriptionResponseSchema = z.object({
  id: z.string(),
  channelId: z.string(),
  connectionId: z.string(),
  topicType: z.string(),
  refreshTaskId: z.string().nullish(),
  refreshTaskCreated: z.boolean(),
});

export const updateSubscriptionSchema = z.object({
  status: z.enum(["active", "disabled"]),
});