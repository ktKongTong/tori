import type { Repository } from "./types.ts";
import type {
  AuthSessionState,
  Connection,
  CreateConnectionParams,
  EncryptedCredentials,
  OAuthClient,
  ProxyRule,
  RequestLog,
  SystemTaskDefinition,
  SystemTaskRun,
  TokenRefreshLog,
} from "../types.ts";

function generateId(prefix: string) {
  return `${prefix}_${Math.random().toString(36).slice(2, 18)}`;
}

/**
 * In-memory repository for local development and tests.
 */
export class MemoryRepository implements Repository {
  connections = new Map<string, Connection & { accessTokenEnc: string; refreshTokenEnc: string }>();
  authCodes = new Map<string, { connectionId: string; expiresAt: number; consumed: boolean }>();
  authSessions = new Map<string, { state: AuthSessionState; expiresAt: number }>();
  oauthClients = new Map<string, OAuthClient>();
  proxyRules: ProxyRule[] = [];
  settingsMap = new Map<string, string>();
  requestLogs: RequestLog[] = [];
  systemTaskDefinitions = new Map<string, SystemTaskDefinition>();
  systemTaskRuns = new Map<string, SystemTaskRun>();
  tokenRefreshLogs: TokenRefreshLog[] = [];

  async createConnection(params: CreateConnectionParams): Promise<Connection> {
    const id = generateId("conn");
    const apiKey = generateId("ak");
    const now = Math.floor(Date.now() / 1000);
    const permissions = params.permissions ?? ["proxy", "account"];
    const conn = {
      id,
      provider: params.provider,
      providerUid: params.providerUid,
      displayName: params.displayName,
      label: params.label ?? null,
      tokenInject: params.tokenInject,
      permissions,
      apiKey,
      status: "active",
      createdAt: now,
      updatedAt: now,
      lastUsedAt: null,
      accessTokenEnc: params.credentials.accessToken,
      refreshTokenEnc: params.credentials.refreshToken,
    };
    this.connections.set(id, conn);
    return conn;
  }

  async getConnectionById(id: string): Promise<Connection | null> {
    return this.connections.get(id) ?? null;
  }

  async getConnectionByApiKey(apiKey: string): Promise<Connection | null> {
    for (const connection of this.connections.values()) {
      if (connection.apiKey === apiKey && connection.status === "active") return connection;
    }

    return null;
  }

  async listConnections(): Promise<Connection[]> {
    return [...this.connections.values()].sort((a, b) => b.createdAt - a.createdAt);
  }

  async updateCredentials(connId: string, creds: EncryptedCredentials): Promise<void> {
    const connection = this.connections.get(connId);
    if (!connection) return;
    connection.accessTokenEnc = creds.accessToken;
    connection.refreshTokenEnc = creds.refreshToken;
  }

  async updateStatus(connId: string, status: string): Promise<void> {
    const connection = this.connections.get(connId);
    if (!connection) return;
    connection.status = status;
    connection.updatedAt = Math.floor(Date.now() / 1000);
  }

  async updateConnection(
    connId: string,
    patch: {
      displayName?: string;
      label?: string | null;
      permissions?: string[];
      status?: string;
      lastUsedAt?: number | null;
      updatedAt?: number;
    },
  ): Promise<Connection | null> {
    const connection = this.connections.get(connId);
    if (!connection) return null;

    if (patch.displayName !== undefined) connection.displayName = patch.displayName;
    if (patch.label !== undefined) connection.label = patch.label;
    if (patch.permissions !== undefined) connection.permissions = patch.permissions;
    if (patch.status !== undefined) connection.status = patch.status;
    if (patch.lastUsedAt !== undefined) connection.lastUsedAt = patch.lastUsedAt;
    connection.updatedAt = patch.updatedAt ?? Math.floor(Date.now() / 1000);

    return connection;
  }

  async deleteConnection(connId: string): Promise<void> {
    this.connections.delete(connId);
  }

  async getCredentials(connId: string): Promise<EncryptedCredentials | null> {
    const connection = this.connections.get(connId);
    if (!connection) return null;
    return {
      accessToken: connection.accessTokenEnc,
      refreshToken: connection.refreshTokenEnc,
    };
  }

  async rotateApiKey(connId: string): Promise<string> {
    const connection = this.connections.get(connId);
    if (!connection) throw new Error("not found");
    connection.apiKey = generateId("ak");
    return connection.apiKey;
  }

  async revokeApiKey(apiKey: string): Promise<void> {
    for (const connection of this.connections.values()) {
      if (connection.apiKey === apiKey) {
        connection.status = "revoked";
      }
    }
  }

  async createAuthCode(connId: string, ttlSec: number, inputCode?: string): Promise<string> {
    const code = inputCode ?? generateId("ac");
    this.authCodes.set(code, {
      connectionId: connId,
      expiresAt: Math.floor(Date.now() / 1000) + ttlSec,
      consumed: false,
    });
    return code;
  }

  async consumeAuthCode(code: string): Promise<string | null> {
    const authCode = this.authCodes.get(code);
    if (!authCode || authCode.consumed || authCode.expiresAt < Math.floor(Date.now() / 1000)) {
      return null;
    }

    authCode.consumed = true;
    return authCode.connectionId;
  }

  async setAuthSession(sid: string, state: AuthSessionState, ttlSec: number): Promise<void> {
    this.authSessions.set(sid, {
      state,
      expiresAt: Math.floor(Date.now() / 1000) + ttlSec,
    });
  }

  async getAuthSession(sid: string): Promise<AuthSessionState | null> {
    const session = this.authSessions.get(sid);
    if (!session || session.expiresAt < Math.floor(Date.now() / 1000)) return null;
    return session.state;
  }

  async deleteAuthSession(sid: string): Promise<void> {
    this.authSessions.delete(sid);
  }

  async createOAuthClient(input: OAuthClient): Promise<OAuthClient> {
    this.oauthClients.set(input.clientId, input);
    return input;
  }

  async getOAuthClient(clientId: string): Promise<OAuthClient | null> {
    return this.oauthClients.get(clientId) ?? null;
  }

  async getProxyRules(provider: string): Promise<ProxyRule[]> {
    return this.proxyRules.filter((rule) => rule.provider === provider);
  }

  async getSetting(key: string): Promise<string | null> {
    return this.settingsMap.get(key) ?? null;
  }

  async setSetting(key: string, value: string): Promise<void> {
    this.settingsMap.set(key, value);
  }

  async createRequestLog(log: {
    connectionId: string;
    routeGroup: string;
    method: string;
    targetUrl?: string | null;
    headers?: Record<string, string> | null;
    query?: Record<string, string | string[]> | null;
    requestBody?: unknown;
    statusCode?: number | null;
    error?: string | null;
    createdAt: number;
  }): Promise<RequestLog> {
    const row: RequestLog = {
      id: this.requestLogs.length + 1,
      connectionId: log.connectionId,
      routeGroup: log.routeGroup,
      method: log.method,
      targetUrl: log.targetUrl ?? null,
      headers: log.headers ?? null,
      query: log.query ?? null,
      requestBody: log.requestBody ?? null,
      statusCode: log.statusCode ?? null,
      error: log.error ?? null,
      createdAt: log.createdAt,
    };
    this.requestLogs.unshift(row);
    return row;
  }

  async listRequestLogs(input?: {
    connectionId?: string;
    limit?: number;
    offset?: number;
  }): Promise<RequestLog[]> {
    const limit = input?.limit ?? 100;
    const offset = input?.offset ?? 0;
    const rows = input?.connectionId
      ? this.requestLogs.filter((row) => row.connectionId === input.connectionId)
      : this.requestLogs;
    return rows.slice(offset, offset + limit);
  }

  async deleteRequestLogsBefore(cutoffCreatedAt: number): Promise<number> {
    const before = this.requestLogs.length;
    this.requestLogs = this.requestLogs.filter((row) => row.createdAt >= cutoffCreatedAt);
    return before - this.requestLogs.length;
  }

  async ensureSystemTaskDefinition(input: {
    id: string;
    kind: string;
    provider: string;
    intervalSec: number;
    payload: Record<string, unknown>;
    nextRunAt: number;
  }): Promise<SystemTaskDefinition> {
    const existing = this.systemTaskDefinitions.get(input.id);
    if (existing) return existing;

    const now = Math.floor(Date.now() / 1000);
    const definition: SystemTaskDefinition = {
      id: input.id,
      kind: input.kind,
      provider: input.provider,
      enabled: true,
      intervalSec: input.intervalSec,
      payload: input.payload,
      nextRunAt: input.nextRunAt,
      lastTriggeredAt: null,
      lastRunAt: null,
      lastRunStatus: null,
      lastError: null,
      createdAt: now,
      updatedAt: now,
    };
    this.systemTaskDefinitions.set(input.id, definition);
    return definition;
  }

  async getSystemTaskDefinition(id: string): Promise<SystemTaskDefinition | null> {
    return this.systemTaskDefinitions.get(id) ?? null;
  }

  async listSystemTaskDefinitions(): Promise<SystemTaskDefinition[]> {
    return [...this.systemTaskDefinitions.values()].sort((a, b) => a.id.localeCompare(b.id));
  }

  async listDueSystemTaskDefinitions(now: number): Promise<SystemTaskDefinition[]> {
    return [...this.systemTaskDefinitions.values()].filter(
      (definition) => definition.enabled && definition.nextRunAt <= now,
    );
  }

  async updateSystemTaskDefinition(
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
  ): Promise<SystemTaskDefinition | null> {
    const definition = this.systemTaskDefinitions.get(id);
    if (!definition) return null;

    if (patch.enabled !== undefined) definition.enabled = patch.enabled;
    if (patch.intervalSec !== undefined) definition.intervalSec = patch.intervalSec;
    if (patch.payload !== undefined) definition.payload = patch.payload;
    if (patch.nextRunAt !== undefined) definition.nextRunAt = patch.nextRunAt;
    if (patch.lastTriggeredAt !== undefined) definition.lastTriggeredAt = patch.lastTriggeredAt;
    if (patch.lastRunAt !== undefined) definition.lastRunAt = patch.lastRunAt;
    if (patch.lastRunStatus !== undefined) definition.lastRunStatus = patch.lastRunStatus;
    if (patch.lastError !== undefined) definition.lastError = patch.lastError;
    definition.updatedAt = patch.updatedAt ?? Math.floor(Date.now() / 1000);

    return definition;
  }

  async createSystemTaskRun(input: {
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
  }): Promise<SystemTaskRun> {
    const run: SystemTaskRun = {
      id: input.id,
      taskDefinitionId: input.taskDefinitionId,
      kind: input.kind,
      status: input.status,
      summary: input.summary ?? null,
      errorMessage: input.errorMessage ?? null,
      scheduledFor: input.scheduledFor ?? null,
      startedAt: input.startedAt ?? null,
      finishedAt: input.finishedAt ?? null,
      createdAt: input.createdAt,
    };
    this.systemTaskRuns.set(input.id, run);
    return run;
  }

  async getSystemTaskRun(id: string): Promise<SystemTaskRun | null> {
    return this.systemTaskRuns.get(id) ?? null;
  }

  async listSystemTaskRuns(input?: {
    taskDefinitionId?: string;
    limit?: number;
  }): Promise<SystemTaskRun[]> {
    const limit = input?.limit ?? 100;
    const rows = [...this.systemTaskRuns.values()]
      .filter((run) => !input?.taskDefinitionId || run.taskDefinitionId === input.taskDefinitionId)
      .sort((a, b) => b.createdAt - a.createdAt);

    return rows.slice(0, limit);
  }

  async updateSystemTaskRun(
    id: string,
    patch: {
      status?: string;
      summary?: Record<string, unknown> | null;
      errorMessage?: string | null;
      startedAt?: number | null;
      finishedAt?: number | null;
    },
  ): Promise<SystemTaskRun | null> {
    const run = this.systemTaskRuns.get(id);
    if (!run) return null;

    if (patch.status !== undefined) run.status = patch.status;
    if (patch.summary !== undefined) run.summary = patch.summary;
    if (patch.errorMessage !== undefined) run.errorMessage = patch.errorMessage;
    if (patch.startedAt !== undefined) run.startedAt = patch.startedAt;
    if (patch.finishedAt !== undefined) run.finishedAt = patch.finishedAt;

    return run;
  }

  async createTokenRefreshLog(log: {
    taskRunId?: string | null;
    connectionId: string;
    provider: string;
    status: string;
    message?: string | null;
    createdAt: number;
  }): Promise<TokenRefreshLog> {
    const row: TokenRefreshLog = {
      id: this.tokenRefreshLogs.length + 1,
      taskRunId: log.taskRunId ?? null,
      connectionId: log.connectionId,
      provider: log.provider,
      status: log.status,
      message: log.message ?? null,
      createdAt: log.createdAt,
    };
    this.tokenRefreshLogs.unshift(row);
    return row;
  }

  async listTokenRefreshLogs(input?: {
    connectionId?: string;
    limit?: number;
    offset?: number;
  }): Promise<TokenRefreshLog[]> {
    const limit = input?.limit ?? 100;
    const offset = input?.offset ?? 0;
    const rows = input?.connectionId
      ? this.tokenRefreshLogs.filter((row) => row.connectionId === input.connectionId)
      : this.tokenRefreshLogs;
    return rows.slice(offset, offset + limit);
  }
}
