import { createRequestClient } from "@repo/request";
import { z } from "zod";

const bindingRequest = createRequestClient({
  credentials: "include",
  retry: 0,
  timeout: 10000,
  headers: {
    accept: "application/json",
  },
});

const userBindingSchema = z.object({
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

const channelBindingSchema = z.object({
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

const claimSessionSchema = z.object({
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

export const userBindingsSchema = z.object({
  items: z.array(userBindingSchema),
});

export const channelBindingsSchema = z.object({
  items: z.array(channelBindingSchema),
});

export const claimSessionsSchema = z.object({
  items: z.array(claimSessionSchema),
});

const statusResponseSchema = z.object({
  id: z.string(),
  status: z.string(),
});

const bindingTokenResponseSchema = z.object({
  grantId: z.string(),
  code: z.string(),
  token: z.string(),
  purpose: z.string(),
  subjectType: z.string(),
  subjectId: z.string(),
  codeExpiresAt: z.string(),
  tokenExpiresAt: z.string(),
});

const consumeAnonymousClaimResponseSchema = z.object({
  resolution: z.string(),
  authenticatedUserId: z.string(),
});

export type UserBinding = z.infer<typeof userBindingsSchema>["items"][number];
export type ChannelBinding = z.infer<typeof channelBindingsSchema>["items"][number];
export type UserBindingRow = {
  binding: UserBinding;
  user: { id: string; name: string } | null;
};
export type ChannelBindingRow = {
  binding: ChannelBinding;
  channel: { id: string; name: string | null } | null;
  botInstance: { id: string; displayName: string | null } | null;
};
export type ClaimSessionRow = z.infer<typeof claimSessionsSchema>["items"][number];

export const listUserBindings = () =>
  bindingRequest.get("/api/binding/user-bindings", { schema: userBindingsSchema });

export const listChannelBindings = () =>
  bindingRequest.get("/api/binding/channel-bindings", { schema: channelBindingsSchema });

export const listClaimSessions = () =>
  bindingRequest.get("/api/binding/claim-sessions", { schema: claimSessionsSchema });

export const issueBindingToken = (subjectId: string) =>
  bindingRequest.post(
    "/api/binding/tokens",
    {
      purpose: "bind-user",
      subjectType: "user",
      subjectId,
      issuedToSurface: "bot",
    },
    { schema: bindingTokenResponseSchema },
  );

export const consumeAnonymousClaim = (token: string) =>
  bindingRequest.post(
    "/api/binding/anonymous-claims/consume",
    { token },
    { schema: consumeAnonymousClaimResponseSchema },
  );

export const revokeUserBinding = (bindingId: string) =>
  bindingRequest.post(
    `/api/binding/user-bindings/${encodeURIComponent(bindingId)}/revoke`,
    undefined,
    { schema: statusResponseSchema },
  );
