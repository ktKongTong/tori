import type { Connection, ProxyInstance } from "./connection.ts";
export type { Connection, ProxyInstance };
import type { AccountProfileRow } from "@/api/modules/steam/core/account/repository";

export interface CreateProxyInstanceInput {
  id: string;
  ownerUserId: string;
  provider: string;
  baseUrl: string;
  credentialRef: string;
  name?: string | null;
  status?: string;
  healthStatus?: string;
  capabilities?: unknown;
  metadata?: unknown;
  lastSeenAt?: Date | null;
}

export interface UpdateProxyInstanceRegistrationInput {
  id: string;
  credentialRef: string;
  name?: string | null;
  healthStatus: string;
  capabilities: unknown;
  metadata?: unknown;
}

export interface UpdateProxyInstanceProbeInput {
  id: string;
  healthStatus: string;
  capabilities: unknown;
}

export interface UpdateProxyInstanceStatusInput {
  id: string;
  ownerUserId: string;
  status: string;
}

export interface CreateConnectionInput {
  id: string;
  ownerUserId: string;
  provider: string;
  providerAccountId: string;
  providerAccountName?: string | null;
  providerAccountAvatar?: string | null;
  accessMode: string;
  proxyInstanceId?: string | null;
  isDefault?: boolean;
  status?: string;
  metadata?: unknown;
  connectedAt?: Date;
  lastSyncedAt?: Date | null;
}

export interface IIntegrationRepository {
  listProxyInstances(): Promise<ProxyInstance[]>;
  listConnections(): Promise<Connection[]>;
  listAccountProfiles(): Promise<AccountProfileRow[]>;
  findProxyInstanceByOwnerAndBaseUrl(input: {
    ownerUserId: string;
    baseUrl: string;
  }): Promise<ProxyInstance | null>;
  updateProxyInstanceRegistration(
    input: UpdateProxyInstanceRegistrationInput,
  ): Promise<ProxyInstance>;
  createProxyInstance(input: CreateProxyInstanceInput): Promise<ProxyInstance>;
  findProxyInstanceForOwner(input: {
    id: string;
    ownerUserId: string;
  }): Promise<ProxyInstance | null>;
  updateProxyInstanceProbe(input: UpdateProxyInstanceProbeInput): Promise<ProxyInstance>;
  updateProxyInstanceStatus(
    input: UpdateProxyInstanceStatusInput,
  ): Promise<ProxyInstance | null>;
  findConnectionByOwnerAndProviderAccount(input: {
    ownerUserId: string;
    provider: string;
    providerAccountId: string;
  }): Promise<Connection | null>;
  createConnection(input: CreateConnectionInput): Promise<Connection>;
  findConnectionById(id: string): Promise<Connection | null>;
}
