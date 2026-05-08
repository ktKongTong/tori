import { z } from 'zod'

export const registerDeliveryEndpointSchema = z.object({
  platform: z.string().min(1),
  kind: z.string().min(1),
  target: z.string().min(1),
  displayName: z.string().nullable().optional(),
  secret: z.string().nullable().optional(),
  config: z.record(z.string(), z.unknown()).optional(),
  metadata: z.record(z.string(), z.unknown()).optional(),
});


export const updateDeliveryEndpointSchema = z.object({
  status: z.enum(["active", "disabled"]),
});

export const deliveryEndpointSchema = z.object({
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