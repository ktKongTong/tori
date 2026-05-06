import { z } from "zod";

export const createBotInstanceSchema = z.object({
  platform: z.string().min(1),
  namespace: z.string().min(1),
  instanceKey: z.string().min(1),
  displayName: z.string().nullable().optional(),
  capabilities: z.record(z.string(), z.any()).optional(),
  autoCreateInternalEndpoint: z.boolean().optional(),
});

export const updateBotInstanceSchema = z.object({
  displayName: z.string().nullable().optional(),
  capabilities: z.record(z.string(), z.any()).optional(),
  status: z.string().optional(),
});

export const attachEndpointSchema = z.object({
  deliveryEndpointId: z.string().nullable(),
});

export type CreateBotInstanceInput = z.infer<typeof createBotInstanceSchema>;
export type UpdateBotInstanceInput = z.infer<typeof updateBotInstanceSchema>;
export type AttachEndpointInput = z.infer<typeof attachEndpointSchema>;
