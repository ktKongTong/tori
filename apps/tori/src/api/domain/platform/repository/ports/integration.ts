/* oxlint-disable typescript-eslint/no-redundant-type-constituents */

import type { ConnectionRow, ProxyInstanceRow } from "./connection.ts";
import type { JsonRecord } from "./common.ts";

export interface CreateProxyInstanceInput {
  id: string;
  ownerUserId: string;
  provider: string;
  baseUrl: string;
  credentialRef: string;
  name?: string | null;
  status?: string;
  healthStatus?: string;
  capabilities?: JsonRecord | null;
  metadata?: JsonRecord | null;
  lastSeenAt?: Date | null;
}

export interface UpdateProxyInstanceRegistrationInput {
  id: string;
  credentialRef: string;
  name?: string | null;
  healthStatus: string;
  capabilities: JsonRecord;
  metadata?: JsonRecord | null;
}

export interface UpdateProxyInstanceProbeInput {
  id: string;
  healthStatus: string;
  capabilities: JsonRecord;
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
  metadata?: JsonRecord | null;
  connectedAt?: Date;
  lastSyncedAt?: Date | null;
}

export interface IIntegrationRepository {
  findProxyInstanceByOwnerAndBaseUrl(input: {
    ownerUserId: string;
    baseUrl: string;
  }): Promise<ProxyInstanceRow | null>;
  updateProxyInstanceRegistration(
    input: UpdateProxyInstanceRegistrationInput,
  ): Promise<ProxyInstanceRow>;
  createProxyInstance(input: CreateProxyInstanceInput): Promise<ProxyInstanceRow>;
  findProxyInstanceForOwner(input: {
    id: string;
    ownerUserId: string;
  }): Promise<ProxyInstanceRow | null>;
  updateProxyInstanceProbe(input: UpdateProxyInstanceProbeInput): Promise<ProxyInstanceRow>;
  updateProxyInstanceStatus(
    input: UpdateProxyInstanceStatusInput,
  ): Promise<ProxyInstanceRow | null>;
  findConnectionByOwnerAndProviderAccount(input: {
    ownerUserId: string;
    provider: string;
    providerAccountId: string;
  }): Promise<ConnectionRow | null>;
  createConnection(input: CreateConnectionInput): Promise<ConnectionRow>;
  findConnectionById(id: string): Promise<ConnectionRow | null>;
}
