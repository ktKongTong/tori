import type {
  AuthSessionState,
  Connection,
  CreateConnectionParams,
  EncryptedCredentials,
  ProxyRule,
  RequestLog,
  SystemTaskDefinition,
  SystemTaskRun,
  TokenRefreshLog,
} from "../types.ts";

/**
 * Platform-agnostic repository interface.
 * Implemented per storage backend (SQLite for D1/Node, PG for Deno/Node).
 */
export interface Repository {
  // ─── Connections ───
  createConnection(params: CreateConnectionParams): Promise<Connection>;
  getConnectionById(id: string): Promise<Connection | null>;
  getConnectionByApiKey(apiKey: string): Promise<Connection | null>;
  listConnections(): Promise<Connection[]>;
  updateCredentials(connId: string, creds: EncryptedCredentials): Promise<void>;
  updateStatus(connId: string, status: string): Promise<void>;
  updateConnection(
    connId: string,
    patch: {
      displayName?: string;
      label?: string | null;
      permissions?: string[];
      status?: string;
      lastUsedAt?: number | null;
      updatedAt?: number;
    },
  ): Promise<Connection | null>;
  deleteConnection(connId: string): Promise<void>;

  // ─── Credentials (encrypted) ───
  getCredentials(connId: string): Promise<EncryptedCredentials | null>;

  // ─── API Keys ───
  rotateApiKey(connId: string): Promise<string>;
  revokeApiKey(apiKey: string): Promise<void>;

  // ─── Auth Codes (one-time, TTL) ───
  createAuthCode(connId: string, ttlSec: number): Promise<string>;
  consumeAuthCode(code: string): Promise<string | null>;

  // ─── Auth Sessions (for client-driven polling) ───
  setAuthSession(sid: string, state: AuthSessionState, ttlSec: number): Promise<void>;
  getAuthSession(sid: string): Promise<AuthSessionState | null>;
  deleteAuthSession(sid: string): Promise<void>;

  // ─── Proxy Rules ───
  getProxyRules(provider: string): Promise<ProxyRule[]>;

  // ─── Settings (encrypted KV) ───
  getSetting(key: string): Promise<string | null>;
  setSetting(key: string, value: string): Promise<void>;

  // ─── Request Logs ───
  createRequestLog(log: {
    connectionId: string;
    routeGroup: string;
    method: string;
    targetUrl?: string | null;
    statusCode?: number | null;
    error?: string | null;
    createdAt: number;
  }): Promise<RequestLog>;
  listRequestLogs(input?: { connectionId?: string; limit?: number }): Promise<RequestLog[]>;

  // ─── System Tasks ───
  ensureSystemTaskDefinition(input: {
    id: string;
    kind: string;
    provider: string;
    intervalSec: number;
    payload: Record<string, unknown>;
    nextRunAt: number;
  }): Promise<SystemTaskDefinition>;
  getSystemTaskDefinition(id: string): Promise<SystemTaskDefinition | null>;
  listSystemTaskDefinitions(): Promise<SystemTaskDefinition[]>;
  listDueSystemTaskDefinitions(now: number): Promise<SystemTaskDefinition[]>;
  updateSystemTaskDefinition(
    id: string,
    patch: {
      enabled?: boolean;
      intervalSec?: number;
      payload?: Record<string, unknown>;
      nextRunAt?: number;
      lastTriggeredAt?: number | null;
      lastRunAt?: number | null;
      lastRunStatus?: string | null;
      lastError?: string | null;
      updatedAt?: number;
    },
  ): Promise<SystemTaskDefinition | null>;
  createSystemTaskRun(input: {
    id: string;
    taskDefinitionId: string;
    kind: string;
    status: string;
    scheduledFor?: number | null;
    summary?: Record<string, unknown> | null;
    errorMessage?: string | null;
    startedAt?: number | null;
    finishedAt?: number | null;
    createdAt: number;
  }): Promise<SystemTaskRun>;
  getSystemTaskRun(id: string): Promise<SystemTaskRun | null>;
  listSystemTaskRuns(input?: {
    taskDefinitionId?: string;
    limit?: number;
  }): Promise<SystemTaskRun[]>;
  updateSystemTaskRun(
    id: string,
    patch: {
      status?: string;
      summary?: Record<string, unknown> | null;
      errorMessage?: string | null;
      startedAt?: number | null;
      finishedAt?: number | null;
    },
  ): Promise<SystemTaskRun | null>;

  // ─── Refresh Logs ───
  createTokenRefreshLog(log: {
    taskRunId?: string | null;
    connectionId: string;
    provider: string;
    status: string;
    message?: string | null;
    createdAt: number;
  }): Promise<TokenRefreshLog>;
  listTokenRefreshLogs(input?: {
    connectionId?: string;
    limit?: number;
  }): Promise<TokenRefreshLog[]>;
}
