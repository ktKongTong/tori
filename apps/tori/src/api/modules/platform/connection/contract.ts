import { PageBasedPaginationResultSchema } from "@repo/utils/schema/paging";
import { z } from "zod";
import { proxyInstanceDtoSchema } from "@/api/modules/platform/integration/contract.ts";

export const connectionDtoSchema = z.object({
  id: z.string(),
  ownerUserId: z.string(),
  proxyInstanceId: z.string().nullable(),
  proxy: proxyInstanceDtoSchema.nullish(),
  provider: z.string(),
  providerAccountId: z.string(),
  providerAccountName: z.string().nullable(),
  providerAccountAvatar: z.string().nullable(),
  accessMode: z.string(),
  status: z.string(),
  isDefault: z.boolean(),
  metadata: z.unknown().nullable(),
  connectedAt: z.string(),
  lastSyncedAt: z.string().nullable(),
  createdAt: z.string(),
  updatedAt: z.string(),
});

export const accountProfileDtoSchema = z.object({
  steamId: z.string(),
  connectionId: z.string(),
  personaName: z.string().nullable(),
  avatarUrl: z.string().nullable(),
  profileUrl: z.string().nullable(),
  metadata: z.unknown().nullable(),
  lastSyncedAt: z.string().nullable(),
  createdAt: z.string(),
  updatedAt: z.string(),
});

export const connectionListDtoSchema = PageBasedPaginationResultSchema(connectionDtoSchema);
export const accountProfileListDtoSchema = PageBasedPaginationResultSchema(accountProfileDtoSchema);

export const createConnectionDtoSchema = z.object({
  provider: z.string().min(1),
  providerAccountId: z.string().min(1),
  providerAccountName: z.string().nullable().optional(),
  providerAccountAvatar: z.string().nullable().optional(),
  accessMode: z.enum(["public-id", "proxy-token", "mixed"]),
  proxyInstanceId: z.string().nullable().optional(),
  isDefault: z.boolean().optional(),
  metadata: z.record(z.string(), z.unknown()).optional(),
});

export const connectionCreatedDtoSchema = connectionDtoSchema;

export const updateConnectionStatusDtoSchema = z.object({
  status: z.enum(["active", "disabled"]),
});

export const connectionStatusResponseDtoSchema = z.object({
  id: z.string(),
  status: z.string(),
});

export const startTokenProxyConnectionDtoSchema = z.object({
  provider: z.string().min(1),
  accessMode: z.enum(["proxy-token", "mixed"]).default("proxy-token"),
});

export const tokenProxyConnectionStartResponseDtoSchema = z.object({
  sessionId: z.string(),
  state: z.string(),
  connectUrl: z.string().url(),
  expiresAt: z.string(),
});

export const tokenProxyConnectionCallbackQuerySchema = z.object({
  sessionId: z.string().min(1),
  state: z.string().min(1),
  code: z.string().min(1).optional(),
  error: z.string().optional(),
  error_description: z.string().optional(),
});

export const accountProfileResponseDtoSchema = z.object({
  connectionId: z.string().optional(),
  externalAccountId: z.string(),
  displayName: z.string().nullish(),
  avatarUrl: z.string().nullish(),
  profileUrl: z.string().nullish(),
  lastSyncedAt: z.string().nullable().optional(),
  fetchedFromNetwork: z.boolean().optional(),
});

export const steamFamilyRefreshResponseDtoSchema = z.object({
  connectionId: z.string(),
  familyId: z.string(),
  librarySize: z.number(),
  syncedAt: z.string(),
  addedCount: z.number(),
  removedCount: z.number(),
});

export type ConnectionDto = z.infer<typeof connectionDtoSchema>;
export type AccountProfileDto = z.infer<typeof accountProfileDtoSchema>;
export type CreateConnectionDto = z.infer<typeof createConnectionDtoSchema>;
export type StartTokenProxyConnectionDto = z.infer<typeof startTokenProxyConnectionDtoSchema>;
export type UpdateConnectionStatusDto = z.infer<typeof updateConnectionStatusDtoSchema>;
