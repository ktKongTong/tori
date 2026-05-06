import { and, eq } from "drizzle-orm";
import { connections, proxyInstances } from "@/api/db/schema/d1";
import type { SqliteDB } from "@/api/domain/infra";
import type {
  CreateConnectionInput,
  CreateProxyInstanceInput,
  IIntegrationRepository,
  UpdateProxyInstanceProbeInput,
  UpdateProxyInstanceRegistrationInput,
  UpdateProxyInstanceStatusInput,
} from "@/api/domain/platform/repository/ports/integration.ts";

export class IntegrationSqliteRepository implements IIntegrationRepository {
  constructor(private readonly db: SqliteDB) {}

  async findProxyInstanceByOwnerAndBaseUrl(input: { ownerUserId: string; baseUrl: string }) {
    const [proxyInstance] = await this.db
      .select()
      .from(proxyInstances)
      .where(
        and(
          eq(proxyInstances.ownerUserId, input.ownerUserId),
          eq(proxyInstances.baseUrl, input.baseUrl),
        ),
      )
      .limit(1);
    return proxyInstance ?? null;
  }

  async updateProxyInstanceRegistration(input: UpdateProxyInstanceRegistrationInput) {
    const [existing] = await this.db
      .select()
      .from(proxyInstances)
      .where(eq(proxyInstances.id, input.id))
      .limit(1);
    const [updated] = await this.db
      .update(proxyInstances)
      .set({
        credentialRef: input.credentialRef,
        name: input.name ?? existing?.name ?? null,
        healthStatus: input.healthStatus,
        capabilities: input.capabilities,
        metadata: Object.assign({}, existing?.metadata, input.metadata),
        updatedAt: new Date(),
      })
      .where(eq(proxyInstances.id, input.id))
      .returning();
    return updated;
  }

  async createProxyInstance(input: CreateProxyInstanceInput) {
    const [proxyInstance] = await this.db
      .insert(proxyInstances)
      .values(input as typeof proxyInstances.$inferInsert)
      .returning();
    return proxyInstance;
  }

  async findProxyInstanceForOwner(input: { id: string; ownerUserId: string }) {
    const [proxyInstance] = await this.db
      .select()
      .from(proxyInstances)
      .where(
        and(eq(proxyInstances.id, input.id), eq(proxyInstances.ownerUserId, input.ownerUserId)),
      )
      .limit(1);
    return proxyInstance ?? null;
  }

  async updateProxyInstanceProbe(input: UpdateProxyInstanceProbeInput) {
    const [updated] = await this.db
      .update(proxyInstances)
      .set({
        healthStatus: input.healthStatus,
        capabilities: input.capabilities,
        lastSeenAt: new Date(),
        updatedAt: new Date(),
      })
      .where(eq(proxyInstances.id, input.id))
      .returning();
    return updated;
  }

  async updateProxyInstanceStatus(input: UpdateProxyInstanceStatusInput) {
    const [updated] = await this.db
      .update(proxyInstances)
      .set({
        status: input.status,
        updatedAt: new Date(),
      })
      .where(
        and(eq(proxyInstances.id, input.id), eq(proxyInstances.ownerUserId, input.ownerUserId)),
      )
      .returning();
    return updated ?? null;
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
    const [connection] = await this.db
      .insert(connections)
      .values({
        ...(input as typeof connections.$inferInsert),
        connectedAt: input.connectedAt ?? new Date(),
      })
      .returning();
    return connection;
  }

  async findConnectionById(id: string) {
    const [connection] = await this.db
      .select()
      .from(connections)
      .where(eq(connections.id, id))
      .limit(1);
    return connection ?? null;
  }
}
