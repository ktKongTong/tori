import { and, defineRelations, desc, eq, isNull, lte } from "drizzle-orm";
import type { PostgresJsDatabase } from "drizzle-orm/postgres-js";
import { randomCode } from "@repo/utils/random";

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
} from "../../types.ts";
import type { Repository } from "../types.ts";
import * as schema from "./schema.ts";

function generateId(prefix: string): string {
  return randomCode(prefix, 16);
}

function parseJsonRecord(value: string | null | undefined) {
  try {
    const parsed = JSON.parse(value ?? "{}");
    return parsed && typeof parsed === "object" && !Array.isArray(parsed)
      ? (parsed as Record<string, unknown>)
      : {};
  } catch {
    return {};
  }
}

function parseJsonArray(value: string | null | undefined) {
  try {
    const parsed = JSON.parse(value ?? '["proxy","account"]');
    return Array.isArray(parsed) ? parsed.map((item) => String(item)) : ["proxy", "account"];
  } catch {
    return ["proxy", "account"];
  }
}

function parseJsonNullable(value: string | null | undefined) {
  if (!value) return null;

  try {
    return JSON.parse(value) as Record<string, unknown>;
  } catch {
    return null;
  }
}

export const relations = defineRelations(schema);

/**
 * PostgreSQL-backed Repository.
 * Used for Deno Deploy (Neon) and Node.js (node-postgres).
 */
export class PgRepository implements Repository {
  private db: PostgresJsDatabase;

  constructor(db: PostgresJsDatabase) {
    this.db = db;
  }

  private mapConnection(row: {
    id: string;
    provider: string;
    providerUid: string;
    displayName: string;
    label: string | null;
    tokenInject: string;
    permissions: string;
    apiKey: string;
    status: string;
    deletedAt: number | null;
    createdAt: number;
    updatedAt: number | null;
    lastUsedAt: number | null;
  }): Connection {
    const permissions = parseJsonArray(row.permissions);

    return {
      id: row.id,
      provider: row.provider,
      providerUid: row.providerUid,
      displayName: row.displayName,
      label: row.label,
      tokenInject: row.tokenInject,
      permissions,
      apiKey: row.apiKey,
      status: row.status,
      deletedAt: row.deletedAt,
      createdAt: row.createdAt,
      updatedAt: row.updatedAt,
      lastUsedAt: row.lastUsedAt,
    };
  }

  private mapSystemTaskDefinition(row: {
    id: string;
    kind: string;
    provider: string;
    enabled: boolean;
    intervalSec: number;
    payload: string;
    nextRunAt: number;
    lastTriggeredAt: number | null;
    lastRunAt: number | null;
    lastRunStatus: string | null;
    lastError: string | null;
    createdAt: number;
    updatedAt: number;
  }): SystemTaskDefinition {
    return {
      id: row.id,
      kind: row.kind,
      provider: row.provider,
      enabled: row.enabled,
      intervalSec: row.intervalSec,
      payload: parseJsonRecord(row.payload),
      nextRunAt: row.nextRunAt,
      lastTriggeredAt: row.lastTriggeredAt,
      lastRunAt: row.lastRunAt,
      lastRunStatus: row.lastRunStatus,
      lastError: row.lastError,
      createdAt: row.createdAt,
      updatedAt: row.updatedAt,
    };
  }

  private mapSystemTaskRun(row: {
    id: string;
    taskDefinitionId: string;
    kind: string;
    status: string;
    summary: string | null;
    errorMessage: string | null;
    scheduledFor: number | null;
    startedAt: number | null;
    finishedAt: number | null;
    createdAt: number;
  }): SystemTaskRun {
    return {
      id: row.id,
      taskDefinitionId: row.taskDefinitionId,
      kind: row.kind,
      status: row.status,
      summary: parseJsonNullable(row.summary),
      errorMessage: row.errorMessage,
      scheduledFor: row.scheduledFor,
      startedAt: row.startedAt,
      finishedAt: row.finishedAt,
      createdAt: row.createdAt,
    };
  }

  async createConnection(params: CreateConnectionParams): Promise<Connection> {
    const id = generateId("conn");
    const apiKey = generateId("ak");
    const now = Math.floor(Date.now() / 1000);
    const permissions = params.permissions ?? ["proxy", "account"];

    await this.db.insert(schema.connections).values({
      id,
      provider: params.provider,
      providerUid: params.providerUid,
      displayName: params.displayName,
      label: params.label ?? null,
      tokenInject: params.tokenInject,
      permissions: JSON.stringify(permissions),
      accessTokenEnc: params.credentials.accessToken,
      refreshTokenEnc: params.credentials.refreshToken,
      apiKey,
      status: "active",
      createdAt: now,
      updatedAt: now,
    });

    return {
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
    };
  }

  async getConnectionById(id: string): Promise<Connection | null> {
    const rows = await this.db
      .select({
        id: schema.connections.id,
        provider: schema.connections.provider,
        providerUid: schema.connections.providerUid,
        displayName: schema.connections.displayName,
        label: schema.connections.label,
        tokenInject: schema.connections.tokenInject,
        permissions: schema.connections.permissions,
        apiKey: schema.connections.apiKey,
        status: schema.connections.status,
        deletedAt: schema.connections.deletedAt,
        createdAt: schema.connections.createdAt,
        updatedAt: schema.connections.updatedAt,
        lastUsedAt: schema.connections.lastUsedAt,
      })
      .from(schema.connections)
      .where(and(eq(schema.connections.id, id), isNull(schema.connections.deletedAt)))
      .limit(1);

    return rows[0] ? this.mapConnection(rows[0]) : null;
  }

  async getConnectionByApiKey(apiKey: string): Promise<Connection | null> {
    const rows = await this.db
      .select({
        id: schema.connections.id,
        provider: schema.connections.provider,
        providerUid: schema.connections.providerUid,
        displayName: schema.connections.displayName,
        label: schema.connections.label,
        tokenInject: schema.connections.tokenInject,
        permissions: schema.connections.permissions,
        apiKey: schema.connections.apiKey,
        status: schema.connections.status,
        deletedAt: schema.connections.deletedAt,
        createdAt: schema.connections.createdAt,
        updatedAt: schema.connections.updatedAt,
        lastUsedAt: schema.connections.lastUsedAt,
      })
      .from(schema.connections)
      .where(
        and(
          eq(schema.connections.apiKey, apiKey),
          eq(schema.connections.status, "active"),
          isNull(schema.connections.deletedAt),
        ),
      )
      .limit(1);

    return rows[0] ? this.mapConnection(rows[0]) : null;
  }

  async listConnections(): Promise<Connection[]> {
    const rows = await this.db
      .select({
        id: schema.connections.id,
        provider: schema.connections.provider,
        providerUid: schema.connections.providerUid,
        displayName: schema.connections.displayName,
        label: schema.connections.label,
        tokenInject: schema.connections.tokenInject,
        permissions: schema.connections.permissions,
        apiKey: schema.connections.apiKey,
        status: schema.connections.status,
        deletedAt: schema.connections.deletedAt,
        createdAt: schema.connections.createdAt,
        updatedAt: schema.connections.updatedAt,
        lastUsedAt: schema.connections.lastUsedAt,
      })
      .from(schema.connections)
      .where(isNull(schema.connections.deletedAt))
      .orderBy(desc(schema.connections.createdAt));

    return rows.map((row) => this.mapConnection(row));
  }

  async updateCredentials(connId: string, creds: EncryptedCredentials): Promise<void> {
    await this.db
      .update(schema.connections)
      .set({
        accessTokenEnc: creds.accessToken,
        refreshTokenEnc: creds.refreshToken,
      })
      .where(eq(schema.connections.id, connId));
  }

  async updateStatus(connId: string, status: string): Promise<void> {
    await this.db
      .update(schema.connections)
      .set({ status, updatedAt: Math.floor(Date.now() / 1000) })
      .where(eq(schema.connections.id, connId));
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
    await this.db
      .update(schema.connections)
      .set({
        ...(patch.displayName !== undefined ? { displayName: patch.displayName } : {}),
        ...(patch.label !== undefined ? { label: patch.label } : {}),
        ...(patch.permissions !== undefined
          ? { permissions: JSON.stringify(patch.permissions) }
          : {}),
        ...(patch.status !== undefined ? { status: patch.status } : {}),
        ...(patch.lastUsedAt !== undefined ? { lastUsedAt: patch.lastUsedAt } : {}),
        updatedAt: patch.updatedAt ?? Math.floor(Date.now() / 1000),
      })
      .where(eq(schema.connections.id, connId));

    return this.getConnectionById(connId);
  }

  async deleteConnection(connId: string): Promise<void> {
    await this.db
      .update(schema.connections)
      .set({ deletedAt: Math.floor(Date.now() / 1000), updatedAt: Math.floor(Date.now() / 1000) })
      .where(eq(schema.connections.id, connId));
  }

  async getCredentials(connId: string): Promise<EncryptedCredentials | null> {
    const rows = await this.db
      .select({
        accessTokenEnc: schema.connections.accessTokenEnc,
        refreshTokenEnc: schema.connections.refreshTokenEnc,
      })
      .from(schema.connections)
      .where(eq(schema.connections.id, connId))
      .limit(1);

    if (!rows[0]) return null;
    return { accessToken: rows[0].accessTokenEnc, refreshToken: rows[0].refreshTokenEnc };
  }

  async rotateApiKey(connId: string): Promise<string> {
    const newKey = generateId("ak");
    await this.db
      .update(schema.connections)
      .set({ apiKey: newKey, updatedAt: Math.floor(Date.now() / 1000) })
      .where(eq(schema.connections.id, connId));
    return newKey;
  }

  async revokeApiKey(apiKey: string): Promise<void> {
    await this.db
      .update(schema.connections)
      .set({
        status: "revoked",
        deletedAt: Math.floor(Date.now() / 1000),
        updatedAt: Math.floor(Date.now() / 1000),
      })
      .where(eq(schema.connections.apiKey, apiKey));
  }

  async createAuthCode(connId: string, ttlSec: number): Promise<string> {
    const code = generateId("ac");
    const expiresAt = Math.floor(Date.now() / 1000) + ttlSec;
    await this.db
      .insert(schema.authCodes)
      .values({ code, connectionId: connId, expiresAt, consumed: false });
    return code;
  }

  async consumeAuthCode(code: string): Promise<string | null> {
    const now = Math.floor(Date.now() / 1000);
    const rows = await this.db
      .select()
      .from(schema.authCodes)
      .where(and(eq(schema.authCodes.code, code), eq(schema.authCodes.consumed, false)))
      .limit(1);

    const row = rows[0];
    if (!row || row.expiresAt < now) return null;

    await this.db
      .update(schema.authCodes)
      .set({ consumed: true })
      .where(eq(schema.authCodes.code, code));

    return row.connectionId;
  }

  async setAuthSession(sid: string, state: AuthSessionState, ttlSec: number): Promise<void> {
    const expiresAt = Math.floor(Date.now() / 1000) + ttlSec;
    const stateJson = JSON.stringify(state);

    await this.db
      .insert(schema.authSessions)
      .values({ sid, state: stateJson, expiresAt })
      .onConflictDoUpdate({
        target: schema.authSessions.sid,
        set: { state: stateJson, expiresAt },
      });
  }

  async getAuthSession(sid: string): Promise<AuthSessionState | null> {
    const now = Math.floor(Date.now() / 1000);
    const rows = await this.db
      .select()
      .from(schema.authSessions)
      .where(eq(schema.authSessions.sid, sid))
      .limit(1);

    const row = rows[0];
    if (!row || row.expiresAt < now) return null;
    return JSON.parse(row.state) as AuthSessionState;
  }

  async deleteAuthSession(sid: string): Promise<void> {
    await this.db.delete(schema.authSessions).where(eq(schema.authSessions.sid, sid));
  }

  async getProxyRules(provider: string): Promise<ProxyRule[]> {
    return this.db.select().from(schema.proxyRules).where(eq(schema.proxyRules.provider, provider));
  }

  async getSetting(key: string): Promise<string | null> {
    const rows = await this.db
      .select()
      .from(schema.settings)
      .where(eq(schema.settings.key, key))
      .limit(1);

    return rows[0]?.value ?? null;
  }

  async setSetting(key: string, value: string): Promise<void> {
    await this.db
      .insert(schema.settings)
      .values({ key, value })
      .onConflictDoUpdate({ target: schema.settings.key, set: { value } });
  }

  async createRequestLog(log: {
    connectionId: string;
    routeGroup: string;
    method: string;
    targetUrl?: string | null;
    statusCode?: number | null;
    error?: string | null;
    createdAt: number;
  }): Promise<RequestLog> {
    const rows = await this.db
      .insert(schema.requestLogs)
      .values({
        connectionId: log.connectionId,
        routeGroup: log.routeGroup,
        method: log.method,
        targetUrl: log.targetUrl ?? null,
        statusCode: log.statusCode ?? null,
        error: log.error ?? null,
        createdAt: log.createdAt,
      })
      .returning();

    return rows[0] as RequestLog;
  }

  async listRequestLogs(input?: { connectionId?: string; limit?: number }): Promise<RequestLog[]> {
    const limit = input?.limit ?? 100;
    const rows = input?.connectionId
      ? await this.db
          .select()
          .from(schema.requestLogs)
          .where(eq(schema.requestLogs.connectionId, input.connectionId))
          .orderBy(desc(schema.requestLogs.id))
          .limit(limit)
      : await this.db
          .select()
          .from(schema.requestLogs)
          .orderBy(desc(schema.requestLogs.id))
          .limit(limit);

    return rows as RequestLog[];
  }

  async ensureSystemTaskDefinition(input: {
    id: string;
    kind: string;
    provider: string;
    intervalSec: number;
    payload: Record<string, unknown>;
    nextRunAt: number;
  }): Promise<SystemTaskDefinition> {
    const existing = await this.getSystemTaskDefinition(input.id);
    if (existing) return existing;

    const now = Math.floor(Date.now() / 1000);
    await this.db.insert(schema.systemTaskDefinitions).values({
      id: input.id,
      kind: input.kind,
      provider: input.provider,
      enabled: true,
      intervalSec: input.intervalSec,
      payload: JSON.stringify(input.payload),
      nextRunAt: input.nextRunAt,
      createdAt: now,
      updatedAt: now,
    });

    return (await this.getSystemTaskDefinition(input.id)) as SystemTaskDefinition;
  }

  async getSystemTaskDefinition(id: string): Promise<SystemTaskDefinition | null> {
    const rows = await this.db
      .select()
      .from(schema.systemTaskDefinitions)
      .where(eq(schema.systemTaskDefinitions.id, id))
      .limit(1);

    return rows[0] ? this.mapSystemTaskDefinition(rows[0]) : null;
  }

  async listSystemTaskDefinitions(): Promise<SystemTaskDefinition[]> {
    const rows = await this.db
      .select()
      .from(schema.systemTaskDefinitions)
      .orderBy(schema.systemTaskDefinitions.provider);

    return rows.map((row) => this.mapSystemTaskDefinition(row));
  }

  async listDueSystemTaskDefinitions(now: number): Promise<SystemTaskDefinition[]> {
    const rows = await this.db
      .select()
      .from(schema.systemTaskDefinitions)
      .where(
        and(
          eq(schema.systemTaskDefinitions.enabled, true),
          lte(schema.systemTaskDefinitions.nextRunAt, now),
        ),
      )
      .orderBy(schema.systemTaskDefinitions.nextRunAt);

    return rows.map((row) => this.mapSystemTaskDefinition(row));
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
    await this.db
      .update(schema.systemTaskDefinitions)
      .set({
        ...(patch.enabled !== undefined ? { enabled: patch.enabled } : {}),
        ...(patch.intervalSec !== undefined ? { intervalSec: patch.intervalSec } : {}),
        ...(patch.payload !== undefined ? { payload: JSON.stringify(patch.payload) } : {}),
        ...(patch.nextRunAt !== undefined ? { nextRunAt: patch.nextRunAt } : {}),
        ...(patch.lastTriggeredAt !== undefined ? { lastTriggeredAt: patch.lastTriggeredAt } : {}),
        ...(patch.lastRunAt !== undefined ? { lastRunAt: patch.lastRunAt } : {}),
        ...(patch.lastRunStatus !== undefined ? { lastRunStatus: patch.lastRunStatus } : {}),
        ...(patch.lastError !== undefined ? { lastError: patch.lastError } : {}),
        updatedAt: patch.updatedAt ?? Math.floor(Date.now() / 1000),
      })
      .where(eq(schema.systemTaskDefinitions.id, id));

    return this.getSystemTaskDefinition(id);
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
    await this.db.insert(schema.systemTaskRuns).values({
      id: input.id,
      taskDefinitionId: input.taskDefinitionId,
      kind: input.kind,
      status: input.status,
      summary: input.summary ? JSON.stringify(input.summary) : null,
      errorMessage: input.errorMessage ?? null,
      scheduledFor: input.scheduledFor ?? null,
      startedAt: input.startedAt ?? null,
      finishedAt: input.finishedAt ?? null,
      createdAt: input.createdAt,
    });

    return (await this.getSystemTaskRun(input.id)) as SystemTaskRun;
  }

  async getSystemTaskRun(id: string): Promise<SystemTaskRun | null> {
    const rows = await this.db
      .select()
      .from(schema.systemTaskRuns)
      .where(eq(schema.systemTaskRuns.id, id))
      .limit(1);

    return rows[0] ? this.mapSystemTaskRun(rows[0]) : null;
  }

  async listSystemTaskRuns(input?: {
    taskDefinitionId?: string;
    limit?: number;
  }): Promise<SystemTaskRun[]> {
    const limit = input?.limit ?? 100;
    const rows = input?.taskDefinitionId
      ? await this.db
          .select()
          .from(schema.systemTaskRuns)
          .where(eq(schema.systemTaskRuns.taskDefinitionId, input.taskDefinitionId))
          .orderBy(desc(schema.systemTaskRuns.createdAt))
          .limit(limit)
      : await this.db
          .select()
          .from(schema.systemTaskRuns)
          .orderBy(desc(schema.systemTaskRuns.createdAt))
          .limit(limit);

    return rows.map((row) => this.mapSystemTaskRun(row));
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
    await this.db
      .update(schema.systemTaskRuns)
      .set({
        ...(patch.status !== undefined ? { status: patch.status } : {}),
        ...(patch.summary !== undefined
          ? { summary: patch.summary ? JSON.stringify(patch.summary) : null }
          : {}),
        ...(patch.errorMessage !== undefined ? { errorMessage: patch.errorMessage } : {}),
        ...(patch.startedAt !== undefined ? { startedAt: patch.startedAt } : {}),
        ...(patch.finishedAt !== undefined ? { finishedAt: patch.finishedAt } : {}),
      })
      .where(eq(schema.systemTaskRuns.id, id));

    return this.getSystemTaskRun(id);
  }

  async createTokenRefreshLog(log: {
    taskRunId?: string | null;
    connectionId: string;
    provider: string;
    status: string;
    message?: string | null;
    createdAt: number;
  }): Promise<TokenRefreshLog> {
    const rows = await this.db
      .insert(schema.tokenRefreshLogs)
      .values({
        taskRunId: log.taskRunId ?? null,
        connectionId: log.connectionId,
        provider: log.provider,
        status: log.status,
        message: log.message ?? null,
        createdAt: log.createdAt,
      })
      .returning();

    return rows[0] as TokenRefreshLog;
  }

  async listTokenRefreshLogs(input?: {
    connectionId?: string;
    limit?: number;
  }): Promise<TokenRefreshLog[]> {
    const limit = input?.limit ?? 100;
    const rows = input?.connectionId
      ? await this.db
          .select()
          .from(schema.tokenRefreshLogs)
          .where(eq(schema.tokenRefreshLogs.connectionId, input.connectionId))
          .orderBy(desc(schema.tokenRefreshLogs.id))
          .limit(limit)
      : await this.db
          .select()
          .from(schema.tokenRefreshLogs)
          .orderBy(desc(schema.tokenRefreshLogs.id))
          .limit(limit);

    return rows as TokenRefreshLog[];
  }
}
