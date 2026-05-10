import { createRequestClient } from "@repo/request";
import type { PageBasedPaginationParam } from "@repo/utils/schema/paging";
import {
  accountProfileListDtoSchema,
  accountProfileResponseDtoSchema,
  connectionListDtoSchema,
  steamFamilyRefreshResponseDtoSchema,
  type AccountProfileDto,
  type ConnectionDto,
} from "@/api/modules/platform/connection/contract";
import {
  integrationStatusResponseDtoSchema,
  proxyInstanceListDtoSchema,
  proxyProbeResponseDtoSchema,
  type ProxyInstanceDto,
  type RegisterProxyInstanceDto,
} from "@/api/modules/platform/integration/contract";

const integrationRequest = createRequestClient({
  credentials: "include",
  retry: 0,
  timeout: 10000,
  headers: {
    accept: "application/json",
  },
});

export const proxyInstancesSchema = proxyInstanceListDtoSchema;
export const connectionsSchema = connectionListDtoSchema;
export const accountProfilesSchema = accountProfileListDtoSchema;

export type IntegrationConnectionListItem = ConnectionDto;

export const listProxyInstances = (
  pagination: PageBasedPaginationParam = { page: 1, pageSize: 100 },
) =>
  integrationRequest.get("/api/integration/proxy-instances", {
    query: pagination,
    schema: proxyInstanceListDtoSchema,
  });

export const registerProxyInstance = (input: RegisterProxyInstanceDto) =>
  integrationRequest.post("/api/integration/proxy-instances", input, {
    schema: proxyProbeResponseDtoSchema,
  });

export const listConnections = (
  pagination: PageBasedPaginationParam = { page: 1, pageSize: 100 },
) =>
  integrationRequest.get("/api/integration/connections", {
    query: pagination,
    schema: connectionListDtoSchema,
  });

export const listAccountProfiles = (
  pagination: PageBasedPaginationParam = { page: 1, pageSize: 100 },
) =>
  integrationRequest.get("/api/integration/account-profiles", {
    query: pagination,
    schema: accountProfileListDtoSchema,
  });

export const probeProxyInstance = (proxyId: string) =>
  integrationRequest.post(
    `/api/integration/proxy-instances/${encodeURIComponent(proxyId)}/probe`,
    undefined,
    { schema: proxyProbeResponseDtoSchema },
  );

export const updateProxyStatus = (input: { id: string; status: "active" | "disabled" }) =>
  integrationRequest.patch(
    `/api/integration/proxy-instances/${encodeURIComponent(input.id)}`,
    { status: input.status },
    { schema: integrationStatusResponseDtoSchema },
  );

export const fetchIntegrationAccountProfile = (connectionId: string) =>
  integrationRequest.get(
    `/api/integration/connections/${encodeURIComponent(connectionId)}/profile`,
    {
      schema: accountProfileResponseDtoSchema,
    },
  );

export const refreshIntegrationFamily = (connectionId: string) =>
  integrationRequest.post(
    `/api/integration/connections/${encodeURIComponent(connectionId)}/family/refresh`,
    undefined,
    { schema: steamFamilyRefreshResponseDtoSchema },
  );
