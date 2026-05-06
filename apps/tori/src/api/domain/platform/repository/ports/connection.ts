/* oxlint-disable typescript-eslint/no-redundant-type-constituents */

import type { JsonRecord } from "./common.ts";

export interface ConnectionRow {
  id: string;
  ownerUserId: string;
  proxyInstanceId: string | null;
  provider: string;
  providerAccountId: string;
  providerAccountName: string | null;
  providerAccountAvatar: string | null;
  accessMode: string;
  status: string;
  isDefault: boolean;
  metadata: JsonRecord | null;
  connectedAt: Date;
  lastSyncedAt: Date | null;
  createdAt: Date;
  updatedAt: Date;
}

export interface ProxyInstanceRow {
  id: string;
  ownerUserId: string;
  provider: string;
  name: string | null;
  baseUrl: string;
  credentialRef: string;
  status: string;
  healthStatus: string;
  capabilities: JsonRecord | null;
  metadata: JsonRecord | null;
  lastSeenAt: Date | null;
  createdAt: Date;
  updatedAt: Date;
}

export interface IConnectionRepository {
  findActiveConnectionById(connectionId: string): Promise<ConnectionRow | null>;
  findActiveConnectionForOwner(input: {
    connectionId: string;
    ownerUserId?: string | null;
  }): Promise<ConnectionRow | null>;
  findDefaultActiveConnectionForOwner(input: {
    ownerUserId: string;
    provider: string;
    excludeAccessMode?: string | null;
  }): Promise<ConnectionRow | null>;
  findProxyInstanceById(proxyInstanceId: string): Promise<ProxyInstanceRow | null>;
}
