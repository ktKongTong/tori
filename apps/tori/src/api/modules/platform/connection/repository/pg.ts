import { and, desc, eq, ne, getColumns, sql } from "drizzle-orm";
import {
  connectionCredentials,
  connections,
  proxyInstances,
  tokenProxyConnectionSessions,
} from "@/api/db/schema/pg";
import { accountProfiles } from "@/api/modules/steam/core/schema/pg";
import type { PGDB } from "@/api/domain/infra";
import type {
  CreateConnectionCredentialInput,
  CreateConnectionInput,
  CreateTokenProxyConnectionSessionInput,
  IConnectionRepository,
} from "./repository.ts";
import type { PageBasedPaginationParam } from "@repo/utils/schema/paging";
import { uniqueId } from "@repo/utils/id";
import { dynamicQuery } from "@repo/db/utils/pg";
import { toPageResult } from "@repo/db/utils";

export class ConnectionPgRepository implements IConnectionRepository {
  constructor(private readonly db: PGDB) {}

  async listConnections(page: PageBasedPaginationParam) {
    const query = this.db
      .select({
        ...getColumns(connections),
        proxy: proxyInstances,
      })
      .from(connections)
      .leftJoin(proxyInstances, eq(proxyInstances.id, connections.proxyInstanceId));

    const [result, total] = await Promise.all([
      dynamicQuery(query.$dynamic(), connections, {
        orderBy: [{ column: "createdAt", direction: "desc" }],
        page,
      }),
      this.db.$count(connections),
    ]);
    return toPageResult(result, total, page);
  }

  async listAccountProfiles(page: PageBasedPaginationParam) {
    const query = this.db
      .select({
        ...getColumns(accountProfiles),
      })
      .from(accountProfiles)
      .innerJoin(
        connections,
        and(eq(connections.id, accountProfiles.connectionId), eq(connections.status, "active")),
      );

    const [result, total] = await Promise.all([
      dynamicQuery(query.$dynamic(), accountProfiles, {
        orderBy: [{ column: "updatedAt", direction: "desc" }],
        page,
      }),
      this.db.$count(
        accountProfiles,
        sql`exists (select 1 from ${connections} where ${connections.id} = ${accountProfiles.connectionId} and ${connections.status} = 'active')`,
      ),
    ]);
    return toPageResult(result, total, page);
  }

  async findConnectionByOwnerAndProviderAccount(input: {
    ownerUserId: string;
    provider: string;
    providerAccountId: string;
  }) {
    const [connection] = await this.db
      .select()
      .from(connections)
      .where(
        and(
          eq(connections.ownerUserId, input.ownerUserId),
          eq(connections.provider, input.provider),
          eq(connections.providerAccountId, input.providerAccountId),
          eq(connections.status, "active"),
        ),
      )
      .limit(1);
    return connection ?? null;
  }

  async findConnectionByOwnerProviderAccountAndAccessMode(input: {
    ownerUserId: string;
    provider: string;
    providerAccountId: string;
    accessMode: string;
  }) {
    const [connection] = await this.db
      .select()
      .from(connections)
      .where(
        and(
          eq(connections.ownerUserId, input.ownerUserId),
          eq(connections.provider, input.provider),
          eq(connections.providerAccountId, input.providerAccountId),
          eq(connections.accessMode, input.accessMode),
          eq(connections.status, "active"),
        ),
      )
      .limit(1);
    return connection ?? null;
  }

  async createConnection(input: CreateConnectionInput) {
    const values: typeof connections.$inferInsert = {
      id: input?.id ?? uniqueId(),
      ownerUserId: input.ownerUserId,
      provider: input.provider,
      providerAccountId: input.providerAccountId,
      providerAccountName: input.providerAccountName ?? null,
      providerAccountAvatar: input.providerAccountAvatar ?? null,
      accessMode: input.accessMode,
      proxyInstanceId: input.proxyInstanceId ?? null,
      isDefault: input.isDefault ?? false,
      status: input.status ?? "active",
      metadata: input.metadata ?? null,
      connectedAt: input.connectedAt ?? new Date(),
      lastSyncedAt: input.lastSyncedAt ?? undefined,
    };
    const [row] = await this.db.insert(connections).values(values).returning();
    return row;
  }

  async findConnectionById(id: string) {
    const [connection] = await this.db
      .select()
      .from(connections)
      .where(eq(connections.id, id))
      .limit(1);
    return connection ?? null;
  }

  async findActiveConnectionById(connectionId: string) {
    const [connection] = await this.db
      .select()
      .from(connections)
      .where(and(eq(connections.id, connectionId), eq(connections.status, "active")))
      .limit(1);
    return connection ?? null;
  }

  async findActiveConnectionForOwner(input: { connectionId: string; ownerUserId?: string | null }) {
    const [connection] = await this.db
      .select()
      .from(connections)
      .where(
        and(
          eq(connections.id, input.connectionId),
          eq(connections.status, "active"),
          input.ownerUserId ? eq(connections.ownerUserId, input.ownerUserId) : undefined,
        ),
      )
      .limit(1);
    return connection ?? null;
  }

  async findProxyInstanceById(proxyInstanceId: string) {
    const [proxyInstance] = await this.db
      .select()
      .from(proxyInstances)
      .where(eq(proxyInstances.id, proxyInstanceId))
      .limit(1);
    return proxyInstance ?? null;
  }

  async findDefaultActiveConnectionForOwner(input: {
    ownerUserId: string;
    provider: string;
    excludeAccessMode?: string | null;
  }) {
    const [connection] = await this.db
      .select()
      .from(connections)
      .where(
        and(
          eq(connections.ownerUserId, input.ownerUserId),
          eq(connections.provider, input.provider),
          eq(connections.status, "active"),
          input.excludeAccessMode ? ne(connections.accessMode, input.excludeAccessMode) : undefined,
        ),
      )
      .orderBy(
        desc(connections.isDefault),
        desc(connections.connectedAt),
        desc(connections.updatedAt),
      )
      .limit(1);
    return connection ?? null;
  }

  async listConnectionsByProxyInstanceId(proxyInstanceId: string) {
    return this.db
      .select()
      .from(connections)
      .where(eq(connections.proxyInstanceId, proxyInstanceId));
  }

  async updateConnectionStatus(input: {
    id: string;
    ownerUserId: string;
    status: "active" | "disabled" | "deleted";
  }) {
    const [connection] = await this.db
      .update(connections)
      .set({
        status: input.status,
        updatedAt: new Date(),
      })
      .where(and(eq(connections.id, input.id), eq(connections.ownerUserId, input.ownerUserId)))
      .returning();
    return connection ?? null;
  }

  async disableActiveConnectionsByProxyInstanceId(proxyInstanceId: string) {
    return this.db
      .update(connections)
      .set({
        status: "disabled",
        updatedAt: new Date(),
      })
      .where(
        and(eq(connections.proxyInstanceId, proxyInstanceId), eq(connections.status, "active")),
      )
      .returning();
  }

  async deleteConnection(input: { id: string; ownerUserId: string }) {
    const [connection] = await this.db
      .update(connections)
      .set({
        status: "deleted",
        updatedAt: new Date(),
      })
      .where(and(eq(connections.id, input.id), eq(connections.ownerUserId, input.ownerUserId)))
      .returning();
    return connection ?? null;
  }

  async createConnectionCredential(input: CreateConnectionCredentialInput) {
    const [row] = await this.db
      .insert(connectionCredentials)
      .values({
        id: input.id,
        connectionId: input.connectionId,
        proxyInstanceId: input.proxyInstanceId,
        kind: input.kind,
        credentialRef: input.credentialRef,
        status: input.status ?? "active",
        metadata: input.metadata ?? null,
        expiresAt: input.expiresAt ?? null,
      })
      .returning();
    return row;
  }

  async updateConnectionCredential(input: {
    id: string;
    proxyInstanceId: string;
    credentialRef: string;
    metadata?: unknown;
    expiresAt?: Date | null;
  }) {
    const [row] = await this.db
      .update(connectionCredentials)
      .set({
        proxyInstanceId: input.proxyInstanceId,
        credentialRef: input.credentialRef,
        metadata: input.metadata ?? null,
        expiresAt: input.expiresAt ?? null,
        updatedAt: new Date(),
      })
      .where(eq(connectionCredentials.id, input.id))
      .returning();
    return row;
  }

  async findActiveConnectionCredential(input: { connectionId: string; kind: string }) {
    const [credential] = await this.db
      .select()
      .from(connectionCredentials)
      .where(
        and(
          eq(connectionCredentials.connectionId, input.connectionId),
          eq(connectionCredentials.kind, input.kind),
          eq(connectionCredentials.status, "active"),
        ),
      )
      .limit(1);
    return credential ?? null;
  }

  async disableActiveConnectionCredentialsByConnectionId(connectionId: string) {
    const rows = await this.db
      .update(connectionCredentials)
      .set({ status: "disabled", updatedAt: new Date() })
      .where(
        and(
          eq(connectionCredentials.connectionId, connectionId),
          eq(connectionCredentials.status, "active"),
        ),
      )
      .returning({ id: connectionCredentials.id });
    return rows.length;
  }

  async deleteConnectionCredentialsByConnectionId(connectionId: string) {
    const rows = await this.db
      .delete(connectionCredentials)
      .where(eq(connectionCredentials.connectionId, connectionId))
      .returning({ id: connectionCredentials.id });
    return rows.length;
  }

  async deleteTokenProxyConnectionSessionsByConnectionId(connectionId: string) {
    const rows = await this.db
      .delete(tokenProxyConnectionSessions)
      .where(eq(tokenProxyConnectionSessions.connectionId, connectionId))
      .returning({ id: tokenProxyConnectionSessions.id });
    return rows.length;
  }

  async deleteTokenProxyConnectionSessionsByProxyInstanceId(proxyInstanceId: string) {
    const rows = await this.db
      .delete(tokenProxyConnectionSessions)
      .where(eq(tokenProxyConnectionSessions.proxyInstanceId, proxyInstanceId))
      .returning({ id: tokenProxyConnectionSessions.id });
    return rows.length;
  }

  async createTokenProxyConnectionSession(input: CreateTokenProxyConnectionSessionInput) {
    const [row] = await this.db
      .insert(tokenProxyConnectionSessions)
      .values({
        id: input.id,
        state: input.state,
        ownerUserId: input.ownerUserId,
        proxyInstanceId: input.proxyInstanceId,
        provider: input.provider,
        accessMode: input.accessMode,
        callbackUrl: input.callbackUrl,
        tokenProxyConnectUrl: input.tokenProxyConnectUrl,
        metadata: input.metadata ?? null,
        expiresAt: input.expiresAt,
      })
      .returning();
    return row;
  }

  async findTokenProxyConnectionSession(input: { id: string; state: string }) {
    const [session] = await this.db
      .select()
      .from(tokenProxyConnectionSessions)
      .where(
        and(
          eq(tokenProxyConnectionSessions.id, input.id),
          eq(tokenProxyConnectionSessions.state, input.state),
        ),
      )
      .limit(1);
    return session ?? null;
  }

  async completeTokenProxyConnectionSession(input: {
    id: string;
    state: string;
    tokenProxyCode: string;
    connectionId: string;
  }) {
    const [row] = await this.db
      .update(tokenProxyConnectionSessions)
      .set({
        status: "completed",
        tokenProxyCode: input.tokenProxyCode,
        connectionId: input.connectionId,
        completedAt: new Date(),
      })
      .where(
        and(
          eq(tokenProxyConnectionSessions.id, input.id),
          eq(tokenProxyConnectionSessions.state, input.state),
        ),
      )
      .returning();
    return row ?? null;
  }

  async failTokenProxyConnectionSession(input: { id: string; state: string; error: string }) {
    const [row] = await this.db
      .update(tokenProxyConnectionSessions)
      .set({
        status: "failed",
        error: input.error,
        completedAt: new Date(),
      })
      .where(
        and(
          eq(tokenProxyConnectionSessions.id, input.id),
          eq(tokenProxyConnectionSessions.state, input.state),
        ),
      )
      .returning();
    return row ?? null;
  }
}
