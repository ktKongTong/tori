import { PageBasedPaginationResultSchema } from "@repo/utils/schema/paging";
import { z } from "zod";

export const proxyProviderDtoSchema = z.object({
  name: z.string(),
  flow: z.string(),
  grantType: z.string(),
});

export const proxyInstanceDtoSchema = z.object({
  id: z.string(),
  ownerUserId: z.string(),
  provider: z.string(),
  name: z.string().nullable(),
  baseUrl: z.string(),
  status: z.string(),
  healthStatus: z.string(),
  capabilities: z.unknown().nullable(),
  metadata: z.unknown().nullable(),
  lastSeenAt: z.string().nullable(),
  createdAt: z.string(),
  updatedAt: z.string(),
});

export const proxyInstanceListDtoSchema = PageBasedPaginationResultSchema(
  proxyInstanceDtoSchema.extend({ providers: z.array(proxyProviderDtoSchema).default([]) }),
);

export const registerProxyInstanceDtoSchema = z.object({
  baseUrl: z.string().url(),
  credentialRef: z.string().min(1),
  name: z.string().nullable().optional(),
  metadata: z.record(z.string(), z.unknown()).optional(),
});

export const proxyProbeResponseDtoSchema = z.object({
  id: z.string().optional(),
  name: z.string().nullable().optional(),
  baseUrl: z.string().optional(),
  healthStatus: z.string(),
  providers: z.array(proxyProviderDtoSchema),
});

export const updateProxyInstanceDtoSchema = z.object({
  status: z.enum(["active", "disabled"]),
});

export const integrationStatusResponseDtoSchema = z.object({
  id: z.string(),
  status: z.string(),
});

export type ProxyInstanceDto = z.infer<typeof proxyInstanceDtoSchema> & {
  providers: z.infer<typeof proxyProviderDtoSchema>[];
};
export type RegisterProxyInstanceDto = z.infer<typeof registerProxyInstanceDtoSchema>;
