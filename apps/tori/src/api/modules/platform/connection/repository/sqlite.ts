import { and, count, desc, eq, ne } from "drizzle-orm";
import { connections, proxyInstances } from "@/api/db/schema/d1";
import { accountProfiles } from "@/api/modules/steam/core/schema/d1";
import type { SqliteDB } from "@/api/domain/infra";
import type {
  ConnectionCredential,
  CreateConnectionCredentialInput,
  CreateConnectionInput,
  CreateTokenProxyConnectionSessionInput,
  IConnectionRepository,
  TokenProxyConnectionSession,
  UpdateConnectionCredentialInput,
} from "./repository.ts";
import { toPageResult } from "@repo/db/utils";
import { withPagination } from "@repo/db/utils/sqlite";
import type { PageBasedPaginationParam } from "@repo/utils/schema/paging";

export class ConnectionSqliteRepository implements IConnectionRepository {
  constructor(private readonly db: SqliteDB) {}

  async listConnections(page: PageBasedPaginationParam) {
    const [data, [{ value: total }]] = await Promise.all([
      withPagination(
        this.db.select().from(connections).orderBy(desc(connections.createdAt)).$dynamic(),
        page,
      ),
      this.db.select({ value: count() }).from(connections),
    ]);
    return toPageResult(data, total ?? 0, page);
  }

  async listAccountProfiles(page: PageBasedPaginationParam) {
    const [data, [{ value: total }]] = await Promise.all([
      withPagination(
        this.db.select().from(accountProfiles).orderBy(desc(accountProfiles.updatedAt)).$dynamic(),
        page,
      ),
      this.db.select({ value: count() }).from(accountProfiles),
    ]);
    return toPageResult(data, total ?? 0, page);
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
        ),
      )
      .limit(1);
    return connection ?? null;
  }

  async createConnection(input: CreateConnectionInput) {
    const [row] = await this.db
      .insert(connections)
      .values({
        id: input.id,
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
        lastSyncedAt: input.lastSyncedAt ?? null,
      })
      .returning();
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
    status: "active" | "disabled";
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
      .delete(connections)
      .where(and(eq(connections.id, input.id), eq(connections.ownerUserId, input.ownerUserId)))
      .returning();
    return connection ?? null;
  }

  async createConnectionCredential(
    input: CreateConnectionCredentialInput,
  ): Promise<ConnectionCredential> {
    void input;
    throw new Error("token-proxy connection credentials are not implemented for sqlite");
  }

  async updateConnectionCredential(
    input: UpdateConnectionCredentialInput,
  ): Promise<ConnectionCredential> {
    void input;
    throw new Error("token-proxy connection credentials are not implemented for sqlite");
  }

  async findActiveConnectionCredential(input: {
    connectionId: string;
    kind: string;
  }): Promise<ConnectionCredential | null> {
    void input;
    throw new Error("token-proxy connection credentials are not implemented for sqlite");
  }

  async disableActiveConnectionCredentialsByConnectionId(connectionId: string) {
    void connectionId;
    return 0;
  }

  async deleteConnectionCredentialsByConnectionId(connectionId: string) {
    void connectionId;
    return 0;
  }

  async deleteTokenProxyConnectionSessionsByConnectionId(connectionId: string) {
    void connectionId;
    return 0;
  }

  async deleteTokenProxyConnectionSessionsByProxyInstanceId(proxyInstanceId: string) {
    void proxyInstanceId;
    return 0;
  }

  async createTokenProxyConnectionSession(
    input: CreateTokenProxyConnectionSessionInput,
  ): Promise<TokenProxyConnectionSession> {
    void input;
    throw new Error("token-proxy connection sessions are not implemented for sqlite");
  }

  async findTokenProxyConnectionSession(input: {
    id: string;
    state: string;
  }): Promise<TokenProxyConnectionSession | null> {
    void input;
    throw new Error("token-proxy connection sessions are not implemented for sqlite");
  }

  async completeTokenProxyConnectionSession(input: {
    id: string;
    state: string;
    tokenProxyCode: string;
    connectionId: string;
  }): Promise<TokenProxyConnectionSession | null> {
    void input;
    throw new Error("token-proxy connection sessions are not implemented for sqlite");
  }

  async failTokenProxyConnectionSession(input: {
    id: string;
    state: string;
    error: string;
  }): Promise<TokenProxyConnectionSession | null> {
    void input;
    throw new Error("token-proxy connection sessions are not implemented for sqlite");
  }
}
