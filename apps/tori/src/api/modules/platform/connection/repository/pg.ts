import { and, desc, eq, ne, getColumns, sql, isNull } from "drizzle-orm";
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
      .leftJoin(proxyInstances, eq(proxyInstances.id, connections.proxyInstanceId))
      .where(isNull(connections.deletedAt));

    const [result, total] = await Promise.all([
      dynamicQuery(query.$dynamic(), connections, {
        orderBy: [{ column: "createdAt", direction: "desc" }],
        page,
      }),
      this.db.$count(connections, isNull(connections.deletedAt)),
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
        and(
          eq(connections.id, accountProfiles.connectionId),
          eq(connections.status, "active"),
          isNull(connections.deletedAt),
        ),
      );

    const [result, total] = await Promise.all([
      dynamicQuery(query.$dynamic(), accountProfiles, {
        orderBy: [{ column: "updatedAt", direction: "desc" }],
        page,
      }),
      this.db.$count(
        accountProfiles,
        sql`exists (select 1 from ${connections} where ${connections.id} = ${accountProfiles.connectionId} and ${connections.status} = 'active' and ${connections.deletedAt} is null)`,
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
          isNull(connections.deletedAt),
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
          isNull(connections.deletedAt),
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
      .where(and(eq(connections.id, id), isNull(connections.deletedAt)))
      .limit(1);
    return connection ?? null;
  }

  async findActiveConnectionById(connectionId: string) {
    const [connection] = await this.db
      .select()
      .from(connections)
      .where(
        and(
          eq(connections.id, connectionId),
          eq(connections.status, "active"),
          isNull(connections.deletedAt),
        ),
      )
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
          isNull(connections.deletedAt),
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
      .where(and(eq(proxyInstances.id, proxyInstanceId), isNull(proxyInstances.deletedAt)))
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
          isNull(connections.deletedAt),
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
      .where(and(eq(connections.proxyInstanceId, proxyInstanceId), isNull(connections.deletedAt)));
  }

  async updateConnectionStatus(input: {
    id: string;
    ownerUserId: string;
    status: "active" | "disabled";
  }) {
    const [connection] = await this.db
      .update(connections)
      .set({
        status: input.status,
        updatedAt: new Date(),
      })
      .where(
        and(
          eq(connections.id, input.id),
          eq(connections.ownerUserId, input.ownerUserId),
          isNull(connections.deletedAt),
        ),
      )
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
        and(
          eq(connections.proxyInstanceId, proxyInstanceId),
          eq(connections.status, "active"),
          isNull(connections.deletedAt),
        ),
      )
      .returning();
  }

  async deleteConnection(input: { id: string; ownerUserId: string }) {
    const [connection] = await this.db
      .update(connections)
      .set({
        deletedAt: new Date(),
        updatedAt: new Date(),
      })
      .where(
        and(
          eq(connections.id, input.id),
          eq(connections.ownerUserId, input.ownerUserId),
          isNull(connections.deletedAt),
        ),
      )
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
      .where(and(eq(connectionCredentials.id, input.id), isNull(connectionCredentials.deletedAt)))
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
          isNull(connectionCredentials.deletedAt),
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
          isNull(connectionCredentials.deletedAt),
        ),
      )
      .returning({ id: connectionCredentials.id });
    return rows.length;
  }

  async deleteConnectionCredentialsByConnectionId(connectionId: string) {
    const rows = await this.db
      .update(connectionCredentials)
      .set({ deletedAt: new Date(), updatedAt: new Date() })
      .where(
        and(
          eq(connectionCredentials.connectionId, connectionId),
          isNull(connectionCredentials.deletedAt),
        ),
      )
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
