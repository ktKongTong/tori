import { z } from "zod";

export const deliveryEndpointDtoSchema = z.object({
  id: z.string(),
  ownerUserId: z.string().nullable(),
  platform: z.string(),
  kind: z.string(),
  displayName: z.string().nullable(),
  target: z.string(),
  secret: z.string().nullable(),
  status: z.string(),
  config: z.unknown().nullable(),
  metadata: z.unknown().nullable(),
  lastUsedAt: z.string().nullable(),
  createdAt: z.string(),
  updatedAt: z.string(),
});

export const registerDeliveryEndpointDtoSchema = z.object({
  platform: z.string().min(1),
  kind: z.string().min(1),
  target: z.string().min(1),
  displayName: z.string().nullable().optional(),
  secret: z.string().nullable().optional(),
  config: z.record(z.string(), z.unknown()).optional(),
  metadata: z.record(z.string(), z.unknown()).optional(),
});

export const updateDeliveryEndpointDtoSchema = z.object({
  status: z.enum(["active", "disabled"]),
});

export const notificationEventDtoSchema = z.object({
  id: z.string(),
  subscriptionId: z.string().nullable(),
  channelId: z.string(),
  botPluginInstanceId: z.string().nullable(),
  deliveryEndpointId: z.string().nullable(),
  channelBindingId: z.string().nullable(),
  title: z.string().nullable(),
  body: z.unknown(),
  payload: z.unknown(),
  status: z.string(),
  sentAt: z.string().nullable(),
  failedAt: z.string().nullable(),
  errorMessage: z.string().nullable(),
  createdAt: z.string(),
});

export const statusUpdateResponseDtoSchema = z.object({
  id: z.string(),
  status: z.string(),
});

export type DeliveryEndpointDto = z.infer<typeof deliveryEndpointDtoSchema>;
export type RegisterDeliveryEndpointDto = z.infer<typeof registerDeliveryEndpointDtoSchema>;
export type NotificationEventDto = z.infer<typeof notificationEventDtoSchema>;
export type StatusUpdateResponseDto = z.infer<typeof statusUpdateResponseDtoSchema>;
