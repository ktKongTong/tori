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

export const dashboardBindingSchema = z.object({
  userBindings: z.array(
    z.object({
      id: z.string(),
      userId: z.string(),
      userName: z.string(),
      platform: z.string(),
      externalUserId: z.string(),
      externalUserName: z.string(),
      assurance: z.string(),
    }),
  ),
  channelBindings: z.array(
    z.object({
      id: z.string(),
      channelId: z.string(),
      channelName: z.string(),
      platform: z.string(),
      externalChannelId: z.string(),
      externalChannelName: z.string(),
      botPluginInstanceId: z.string().nullable(),
      botInstanceName: z.string(),
    }),
  ),
  claimSessions: z.array(
    z.object({
      id: z.string(),
      purpose: z.string(),
      status: z.string(),
      anonymousUserId: z.string().nullable(),
      anonymousUserName: z.string(),
      platform: z.string(),
      observedUserId: z.string().nullable(),
      observedUserName: z.string(),
      observedChannelId: z.string().nullable(),
      observedChannelName: z.string(),
    }),
  ),
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

export type DashboardBindingData = z.infer<typeof dashboardBindingSchema>;

export const getBinding = () =>
  bindingRequest.get("/api/dashboard/binding", { schema: dashboardBindingSchema });

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
