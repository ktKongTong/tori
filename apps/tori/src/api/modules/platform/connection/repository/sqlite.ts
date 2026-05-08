import { and, count, desc, eq, ne } from "drizzle-orm";
import { connections, proxyInstances } from "@/api/db/schema/d1";
import { accountProfiles } from "@/api/modules/steam/core/schema/d1";
import type { SqliteDB } from "@/api/domain/infra";
import type { CreateConnectionInput, IConnectionRepository } from "./repository.ts";
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
}
