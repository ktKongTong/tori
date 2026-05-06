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

const proxyProviderResponseSchema = z.object({
  name: z.string(),
  flow: z.string(),
  grantType: z.string(),
});

export const dashboardIntegrationSchema = z.object({
  proxyInstances: z.array(
    z.object({
      id: z.string(),
      ownerUserId: z.string(),
      name: z.string(),
      provider: z.string(),
      baseUrl: z.string(),
      status: z.string(),
      healthStatus: z.string(),
      providers: z.array(proxyProviderResponseSchema),
    }),
  ),
  connections: z.array(
    z.object({
      id: z.string(),
      ownerUserId: z.string(),
      provider: z.string(),
      providerAccountName: z.string().nullable(),
      accountLabel: z.string(),
      providerAccountId: z.string(),
      accessMode: z.string(),
      proxyInstanceId: z.string().nullable(),
      proxyName: z.string().nullable(),
      isDefault: z.boolean(),
      status: z.string(),
      accountProfile: z
        .object({
          externalAccountId: z.string(),
          displayName: z.string().nullable(),
          avatarUrl: z.string().nullable(),
          profileUrl: z.string().nullable(),
          lastSyncedAt: z.string().nullable(),
        })
        .nullable(),
    }),
  ),
});

const statusResponseSchema = z.object({
  id: z.string(),
  status: z.string(),
});

const refreshFamilyResponseSchema = z.object({
  connectionId: z.string(),
  familyId: z.string(),
  librarySize: z.number(),
  syncedAt: z.string(),
  addedCount: z.number(),
  removedCount: z.number(),
});

const accountProfileResponseSchema = z.object({
  externalAccountId: z.string(),
  displayName: z.string().nullish(),
  avatarUrl: z.string().nullish(),
  profileUrl: z.string().nullish(),
});

const registerProxyResponseSchema = z.object({
  id: z.string(),
  name: z.string().nullable(),
  baseUrl: z.string(),
  healthStatus: z.string(),
  providers: z.array(proxyProviderResponseSchema),
});

const probeProxyResponseSchema = z.object({
  id: z.string(),
  healthStatus: z.string(),
  providers: z.array(proxyProviderResponseSchema),
});

export type DashboardIntegrationData = z.infer<typeof dashboardIntegrationSchema>;

export type RegisterProxyInput = {
  name: string;
  baseUrl: string;
  credentialRef: string;
};

export const getIntegration = () =>
  integrationRequest.get("/api/dashboard/integration", { schema: dashboardIntegrationSchema });

export const refreshIntegrationFamily = (connectionId: string) =>
  integrationRequest.post(
    `/api/integration/connections/${encodeURIComponent(connectionId)}/family/refresh`,
    undefined,
    { schema: refreshFamilyResponseSchema },
  );

export const fetchIntegrationAccountProfile = (connectionId: string) =>
  integrationRequest.get(
    `/api/integration/connections/${encodeURIComponent(connectionId)}/account-profile`,
    { schema: accountProfileResponseSchema },
  );

export const registerProxyInstance = (input: RegisterProxyInput) =>
  integrationRequest.post("/api/integration/proxy-instances", input, {
    schema: registerProxyResponseSchema,
  });

export const probeProxyInstance = (proxyId: string) =>
  integrationRequest.post(
    `/api/integration/proxy-instances/${encodeURIComponent(proxyId)}/probe`,
    undefined,
    { schema: probeProxyResponseSchema },
  );

export const updateProxyStatus = (input: { id: string; status: "active" | "disabled" }) =>
  integrationRequest.patch(
    `/api/integration/proxy-instances/${encodeURIComponent(input.id)}`,
    { status: input.status },
    { schema: statusResponseSchema },
  );
