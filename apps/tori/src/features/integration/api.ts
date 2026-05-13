import { createRequestClient } from "@repo/request";
import type { PageBasedPaginationParam } from "@repo/utils/schema/paging";
import {
  accountProfileListDtoSchema,
  accountProfileResponseDtoSchema,
  connectionListDtoSchema,
  connectionStatusResponseDtoSchema,
  steamFamilyRefreshResponseDtoSchema,
  tokenProxyConnectionStartResponseDtoSchema,
  type ConnectionDto,
  type StartTokenProxyConnectionDto,
} from "@/api/modules/platform/integration/connection/contract";
import {
  integrationStatusResponseDtoSchema,
  proxyInstanceListDtoSchema,
  proxyProbeResponseDtoSchema,
  type RegisterProxyInstanceDto,
} from "@/api/modules/platform/integration/proxy-instance/contract";
import {
  actionCheckResponseSchema,
  type ActionCheckAction,
} from "@/api/modules/platform/shared/action-check";

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

export const startTokenProxyConnection = (
  proxyInstanceId: string,
  input: StartTokenProxyConnectionDto,
) =>
  integrationRequest.post(
    `/api/integration/proxy-instances/${encodeURIComponent(proxyInstanceId)}/connections/start`,
    input,
    {
      schema: tokenProxyConnectionStartResponseDtoSchema,
    },
  );

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

export const deleteProxyInstance = (id: string) =>
  integrationRequest.delete(`/api/integration/proxy-instances/${encodeURIComponent(id)}`, {
    schema: integrationStatusResponseDtoSchema,
  });

export const checkProxyAction = (input: { id: string; action: ActionCheckAction }) =>
  integrationRequest.post(
    `/api/integration/proxy-instances/${encodeURIComponent(input.id)}/action-check`,
    { action: input.action },
    { schema: actionCheckResponseSchema },
  );

export const updateConnectionStatus = (input: { id: string; status: "active" | "disabled" }) =>
  integrationRequest.patch(
    `/api/integration/connections/${encodeURIComponent(input.id)}`,
    { status: input.status },
    { schema: connectionStatusResponseDtoSchema },
  );

export const deleteConnection = (id: string) =>
  integrationRequest.delete(`/api/integration/connections/${encodeURIComponent(id)}`, {
    schema: connectionStatusResponseDtoSchema,
  });

export const checkConnectionAction = (input: { id: string; action: ActionCheckAction }) =>
  integrationRequest.post(
    `/api/integration/connections/${encodeURIComponent(input.id)}/action-check`,
    { action: input.action },
    { schema: actionCheckResponseSchema },
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
