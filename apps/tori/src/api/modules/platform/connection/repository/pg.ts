import { and, desc, eq, ne, getColumns } from "drizzle-orm";
import { connections, proxyInstances } from "@/api/db/schema/pg";
import { accountProfiles } from "@/api/modules/steam/core/schema/pg";
import type { PGDB } from "@/api/domain/infra";
import type { CreateConnectionInput, IConnectionRepository } from "./repository.ts";
import { list } from "@repo/db/utils/pg";
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
    return list(this.db, accountProfiles, {
      orderBy: [{ column: "updatedAt", direction: "desc" }],
      page,
    });
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
}
