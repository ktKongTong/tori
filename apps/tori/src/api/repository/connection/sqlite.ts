import { and, desc, eq, ne } from "drizzle-orm";
import { connections, proxyInstances } from "@/api/db/schema/d1";
import type { SqliteDB } from "@/api/domain/infra";
import type { IConnectionRepository } from "@/api/domain/platform/repository/ports/connection.ts";

export class ConnectionSqliteRepository implements IConnectionRepository {
  constructor(private readonly db: SqliteDB) {}

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
