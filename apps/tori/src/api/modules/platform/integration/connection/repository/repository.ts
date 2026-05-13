import type {
  PageBasedPaginationParam,
  PageBasedPaginationResult,
} from "@repo/utils/schema/paging";
import type { AccountProfileRow } from "@/api/modules/steam/core/account/repository";
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
  deletedAt: Date | null;
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
  deletedAt: Date | null;
  createdAt: Date;
  updatedAt: Date;
}

export interface ConnectionCredential {
  id: string;
  connectionId: string;
  proxyInstanceId: string;
  kind: string;
  credentialRef: string;
  status: string;
  metadata: unknown;
  lastUsedAt: Date | null;
  expiresAt: Date | null;
  deletedAt: Date | null;
  createdAt: Date;
  updatedAt: Date;
}

export interface TokenProxyConnectionSession {
  id: string;
  state: string;
  ownerUserId: string;
  proxyInstanceId: string;
  provider: string;
  accessMode: string;
  status: string;
  callbackUrl: string;
  tokenProxyConnectUrl: string;
  tokenProxyCode: string | null;
  connectionId: string | null;
  error: string | null;
  metadata: unknown;
  expiresAt: Date;
  completedAt: Date | null;
  createdAt: Date;
  updatedAt: Date;
}

export interface CreateConnectionInput {
  id?: string;
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

export interface CreateConnectionCredentialInput {
  id: string;
  connectionId: string;
  proxyInstanceId: string;
  kind: string;
  credentialRef: string;
  status?: string;
  metadata?: unknown;
  expiresAt?: Date | null;
}

export interface UpdateConnectionCredentialInput {
  id: string;
  proxyInstanceId: string;
  credentialRef: string;
  metadata?: unknown;
  expiresAt?: Date | null;
}

export interface CreateTokenProxyConnectionSessionInput {
  id: string;
  state: string;
  ownerUserId: string;
  proxyInstanceId: string;
  provider: string;
  accessMode: string;
  callbackUrl: string;
  tokenProxyConnectUrl: string;
  metadata?: unknown;
  expiresAt: Date;
}

export interface IConnectionRepository {
  listConnections(page: PageBasedPaginationParam): Promise<PageBasedPaginationResult<Connection>>;
  listConnectionsForOwner(
    ownerUserId: string,
    page: PageBasedPaginationParam,
  ): Promise<PageBasedPaginationResult<Connection>>;
  listAccountProfiles(
    page: PageBasedPaginationParam,
  ): Promise<PageBasedPaginationResult<AccountProfileRow>>;
  listAccountProfilesForOwner(
    ownerUserId: string,
    page: PageBasedPaginationParam,
  ): Promise<PageBasedPaginationResult<AccountProfileRow>>;
  findConnectionByOwnerAndProviderAccount(input: {
    ownerUserId: string;
    provider: string;
    providerAccountId: string;
  }): Promise<Connection | null>;
  findConnectionByOwnerProviderAccountAndAccessMode(input: {
    ownerUserId: string;
    provider: string;
    providerAccountId: string;
    accessMode: string;
  }): Promise<Connection | null>;
  createConnection(input: CreateConnectionInput): Promise<Connection>;
  findConnectionById(id: string): Promise<Connection | null>;
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
  listConnectionsByProxyInstanceId(proxyInstanceId: string): Promise<Connection[]>;
  findProxyInstanceById(proxyInstanceId: string): Promise<ProxyInstance | null>;
  updateConnectionStatus(input: {
    id: string;
    ownerUserId: string;
    status: "active" | "disabled" | "deleted";
  }): Promise<Connection | null>;
  disableActiveConnectionsByProxyInstanceId(proxyInstanceId: string): Promise<Connection[]>;
  deleteConnection(input: { id: string; ownerUserId: string }): Promise<Connection | null>;
  createConnectionCredential(input: CreateConnectionCredentialInput): Promise<ConnectionCredential>;
  updateConnectionCredential(input: UpdateConnectionCredentialInput): Promise<ConnectionCredential>;
  findActiveConnectionCredential(input: {
    connectionId: string;
    kind: string;
  }): Promise<ConnectionCredential | null>;
  disableActiveConnectionCredentialsByConnectionId(connectionId: string): Promise<number>;
  deleteConnectionCredentialsByConnectionId(connectionId: string): Promise<number>;
  deleteTokenProxyConnectionSessionsByConnectionId(connectionId: string): Promise<number>;
  deleteTokenProxyConnectionSessionsByProxyInstanceId(proxyInstanceId: string): Promise<number>;
  createTokenProxyConnectionSession(
    input: CreateTokenProxyConnectionSessionInput,
  ): Promise<TokenProxyConnectionSession>;
  findTokenProxyConnectionSession(input: {
    id: string;
    state: string;
  }): Promise<TokenProxyConnectionSession | null>;
  completeTokenProxyConnectionSession(input: {
    id: string;
    state: string;
    tokenProxyCode: string;
    connectionId: string;
  }): Promise<TokenProxyConnectionSession | null>;
  failTokenProxyConnectionSession(input: {
    id: string;
    state: string;
    error: string;
  }): Promise<TokenProxyConnectionSession | null>;
}
