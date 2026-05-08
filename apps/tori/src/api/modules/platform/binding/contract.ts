import { PageBasedPaginationResultSchema } from "@repo/utils/schema/paging";
import { z } from "zod";

export const userBindingDtoSchema = z.object({
  id: z.string(),
  userId: z.string(),
  platform: z.string(),
  externalUserId: z.string(),
  externalUserName: z.string().nullable(),
  namespace: z.string().nullable(),
  source: z.string(),
  assurance: z.string(),
  establishedByGrantId: z.string().nullable(),
  status: z.string(),
  supersededByBindingId: z.string().nullable(),
  revokedReason: z.string().nullable(),
  metadata: z.unknown().nullable(),
  createdAt: z.string(),
  updatedAt: z.string(),
  endedAt: z.string().nullable(),
});

export const channelBindingDtoSchema = z.object({
  id: z.string(),
  channelId: z.string(),
  platform: z.string(),
  externalChannelId: z.string(),
  externalChannelName: z.string().nullable(),
  namespace: z.string().nullable(),
  botPluginInstanceId: z.string().nullable(),
  source: z.string(),
  assurance: z.string(),
  establishedByGrantId: z.string().nullable(),
  status: z.string(),
  supersededByBindingId: z.string().nullable(),
  revokedReason: z.string().nullable(),
  metadata: z.unknown().nullable(),
  createdAt: z.string(),
  updatedAt: z.string(),
  endedAt: z.string().nullable(),
});

export const claimSessionDtoSchema = z.object({
  id: z.string(),
  initiatedFrom: z.string(),
  purpose: z.string(),
  subjectType: z.string(),
  subjectId: z.string().nullable(),
  anonymousUserId: z.string().nullable(),
  anonymousUserName: z.string().nullable(),
  observedUserPlatform: z.string().nullable(),
  observedUserId: z.string().nullable(),
  observedUserName: z.string().nullable(),
  observedUserNamespace: z.string().nullable(),
  observedChannelPlatform: z.string().nullable(),
  observedChannelId: z.string().nullable(),
  observedChannelName: z.string().nullable(),
  observedChannelNamespace: z.string().nullable(),
  grantId: z.string().nullable(),
  status: z.string(),
  resolvedUserId: z.string().nullable(),
  resolvedChannelId: z.string().nullable(),
  resolution: z.string().nullable(),
  metadata: z.unknown().nullable(),
  createdAt: z.string(),
  updatedAt: z.string(),
  resolvedAt: z.string().nullable(),
});

export const userBindingListDtoSchema = PageBasedPaginationResultSchema(userBindingDtoSchema);

export const channelBindingListDtoSchema = PageBasedPaginationResultSchema(channelBindingDtoSchema);

export const claimSessionListDtoSchema = PageBasedPaginationResultSchema(claimSessionDtoSchema);

export const issueBindingTokenDtoSchema = z.object({
  purpose: z.literal("bind-user"),
  subjectType: z.literal("user"),
  subjectId: z.string().min(1),
  issuedToSurface: z.literal("bot"),
  codeExpiresAt: z.string().datetime().optional(),
  tokenExpiresAt: z.string().datetime().optional(),
  maxUses: z.number().int().positive().optional(),
  metadata: z.record(z.string(), z.unknown()).optional(),
});

export const bindingTokenResponseDtoSchema = z.object({
  grantId: z.string(),
  code: z.string(),
  token: z.string(),
  purpose: z.string(),
  subjectType: z.string(),
  subjectId: z.string(),
  codeExpiresAt: z.string(),
  tokenExpiresAt: z.string(),
});

export const consumeAnonymousClaimDtoSchema = z.object({
  token: z.string().min(1),
});

export const consumeAnonymousClaimResponseDtoSchema = z.object({
  claimSessionId: z.string().optional(),
  anonymousUserId: z.string().optional(),
  resolution: z.string(),
  authenticatedUserId: z.string(),
});

export const bindingStatusResponseDtoSchema = z.object({
  id: z.string(),
  status: z.string(),
});

export type UserBindingDto = z.infer<typeof userBindingDtoSchema>;
export type ChannelBindingDto = z.infer<typeof channelBindingDtoSchema>;
export type ClaimSessionDto = z.infer<typeof claimSessionDtoSchema>;
export type IssueBindingTokenDto = z.infer<typeof issueBindingTokenDtoSchema>;
export type ConsumeAnonymousClaimDto = z.infer<typeof consumeAnonymousClaimDtoSchema>;
