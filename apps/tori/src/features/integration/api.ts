import { createRequestClient } from "@repo/request";
import { z } from "zod";

const integrationRequest = createRequestClient({
  credentials: "include",
  retry: 0,
  timeout: 10000,
  headers: {
    accept: "application/json",
  },
});

const proxyInstanceSchema = z.object({
  id: z.string(),
  ownerUserId: z.string(),
  provider: z.string(),
  name: z.string().nullable(),
  baseUrl: z.string(),
  credentialRef: z.string(),
  status: z.string(),
  healthStatus: z.string(),
  capabilities: z.unknown().nullable(),
  metadata: z.unknown().nullable(),
  lastSeenAt: z.string().nullable(),
  createdAt: z.string(),
  updatedAt: z.string(),
});

const connectionSchema = z.object({
  id: z.string(),
  ownerUserId: z.string(),
  proxyInstanceId: z.string().nullable(),
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

const accountProfileSchema = z.object({
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

const proxyProviderSchema = z.object({
  name: z.string(),
  flow: z.string(),
  grantType: z.string(),
});

const proxyProbeResponseSchema = z.object({
  id: z.string().optional(),
  name: z.string().nullable().optional(),
  baseUrl: z.string().optional(),
  healthStatus: z.string(),
  providers: z.array(proxyProviderSchema),
});

export const proxyInstancesSchema = z.object({
  items: z.array(
    proxyInstanceSchema.extend({ providers: z.array(proxyProviderSchema).default([]) }),
  ),
});

export const connectionsSchema = z.object({
  items: z.array(connectionSchema),
});

export const accountProfilesSchema = z.object({
  items: z.array(accountProfileSchema),
});

const statusResponseSchema = z.object({
  id: z.string(),
  status: z.string(),
});

const accountProfileResponseSchema = z.object({
  externalAccountId: z.string(),
  displayName: z.string().nullish(),
  avatarUrl: z.string().nullish(),
  profileUrl: z.string().nullish(),
});

export type ProxyInstanceRow = z.infer<typeof proxyInstancesSchema>["items"][number];
export type ConnectionRow = z.infer<typeof connectionsSchema>["items"][number];
export type AccountProfileRow = z.infer<typeof accountProfilesSchema>["items"][number];
export type IntegrationConnectionRow = {
  connection: ConnectionRow;
  proxy: ProxyInstanceRow | null;
  profile: AccountProfileRow | null;
};

export const listProxyInstances = () =>
  integrationRequest.get("/api/integration/proxy-instances", { schema: proxyInstancesSchema });

export const registerProxyInstance = (input: {
  baseUrl: string;
  credentialRef: string;
  name?: string | null;
}) =>
  integrationRequest.post("/api/integration/proxy-instances", input, {
    schema: proxyProbeResponseSchema,
  });

export const listConnections = () =>
  integrationRequest.get("/api/integration/connections", { schema: connectionsSchema });

export const listAccountProfiles = () =>
  integrationRequest.get("/api/integration/account-profiles", { schema: accountProfilesSchema });

export const probeProxyInstance = (proxyId: string) =>
  integrationRequest.post(
    `/api/integration/proxy-instances/${encodeURIComponent(proxyId)}/probe`,
    undefined,
    { schema: proxyProbeResponseSchema },
  );

export const updateProxyStatus = (input: { id: string; status: "active" | "disabled" }) =>
  integrationRequest.patch(
    `/api/integration/proxy-instances/${encodeURIComponent(input.id)}`,
    { status: input.status },
    { schema: statusResponseSchema },
  );

export const fetchIntegrationAccountProfile = (connectionId: string) =>
  integrationRequest.get(
    `/api/integration/connections/${encodeURIComponent(connectionId)}/profile`,
    {
      schema: accountProfileResponseSchema,
    },
  );

export const refreshIntegrationFamily = (connectionId: string) =>
  integrationRequest.post(
    `/api/integration/connections/${encodeURIComponent(connectionId)}/family/refresh`,
    undefined,
    { schema: z.unknown() },
  );
