export interface Connection {
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
  metadata: unknown;
  connectedAt: Date;
  lastSyncedAt: Date | null;
  createdAt: Date;
  updatedAt: Date;
}

export interface ProxyInstance {
  id: string;
  ownerUserId: string;
  provider: string;
  name: string | null;
  baseUrl: string;
  credentialRef: string;
  status: string;
  healthStatus: string;
  capabilities: unknown;
  metadata: unknown;
  lastSeenAt: Date | null;
  createdAt: Date;
  updatedAt: Date;
}

export interface IConnectionRepository {
  findActiveConnectionById(connectionId: string): Promise<Connection | null>;
  findActiveConnectionForOwner(input: {
    connectionId: string;
    ownerUserId?: string | null;
  }): Promise<Connection | null>;
  findDefaultActiveConnectionForOwner(input: {
    ownerUserId: string;
    provider: string;
    excludeAccessMode?: string | null;
  }): Promise<Connection | null>;
  findProxyInstanceById(proxyInstanceId: string): Promise<ProxyInstance | null>;
}
