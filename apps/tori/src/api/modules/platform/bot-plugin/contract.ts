import { PageBasedPaginationResultSchema } from "@repo/utils/schema/paging";
import { z } from "zod";

export const botInstanceDtoSchema = z.object({
  id: z.string(),
  ownerUserId: z.string(),
  platform: z.string(),
  namespace: z.string(),
  instanceKey: z.string(),
  displayName: z.string().nullable(),
  callbackMode: z.string(),
  deliveryEndpointId: z.string().nullable(),
  status: z.string(),
  lastSeenAt: z.string().nullable(),
});

export const botInstanceListDtoSchema = PageBasedPaginationResultSchema(botInstanceDtoSchema);

export const createBotInstanceDtoSchema = z.object({
  platform: z.string().min(1),
  namespace: z.string().min(1),
  instanceKey: z.string().min(1),
  displayName: z.string().nullable().optional(),
  capabilities: z.record(z.string(), z.unknown()).optional(),
  deliveryEndpoint: z
    .object({
      kind: z.string().min(1),
      target: z.string().min(1),
      displayName: z.string().nullable().optional(),
      secret: z.string().nullable().optional(),
      config: z.record(z.string(), z.unknown()).optional(),
      metadata: z.record(z.string(), z.unknown()).optional(),
    })
    .optional(),
  autoCreateInternalEndpoint: z.boolean().optional(),
});

export const updateBotInstanceDtoSchema = z.object({
  displayName: z.string().nullable().optional(),
  capabilities: z.record(z.string(), z.unknown()).optional(),
  status: z.string().optional(),
});

export const attachEndpointDtoSchema = z.object({
  deliveryEndpointId: z.string().nullable(),
});

export const createBotInstanceResponseDtoSchema = z.object({
  id: z.string(),
  platform: z.string().optional(),
  namespace: z.string().optional(),
  instanceKey: z.string().optional(),
  plaintextCredential: z.string(),
  deliveryEndpointId: z.string().nullable(),
  created: z.boolean(),
});

export const rotateBotInstanceCredentialResponseDtoSchema = z.object({
  id: z.string(),
  plaintextCredential: z.string(),
});

export const attachBotInstanceEndpointResponseDtoSchema = z.object({
  id: z.string(),
  deliveryEndpointId: z.string().nullable(),
});

export const botInstanceStatusResponseDtoSchema = z.object({
  id: z.string(),
  status: z.string(),
});

export type BotInstanceDto = z.infer<typeof botInstanceDtoSchema>;
export type CreateBotInstanceDto = z.infer<typeof createBotInstanceDtoSchema>;
export type UpdateBotInstanceDto = z.infer<typeof updateBotInstanceDtoSchema>;
export type AttachEndpointDto = z.infer<typeof attachEndpointDtoSchema>;
