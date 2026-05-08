import { and, eq, desc } from "drizzle-orm";
import { proxyInstances, connections } from "@/api/db/schema/pg";
import { accountProfiles } from "@/api/modules/steam/core/schema/pg";
import type { PGDB } from "@/api/domain/infra";
import type {
  CreateConnectionInput,
  CreateProxyInstanceInput,
  IIntegrationRepository,
  UpdateProxyInstanceProbeInput,
  UpdateProxyInstanceRegistrationInput,
  UpdateProxyInstanceStatusInput,
} from "@/api/domain/platform/repository/ports/integration.ts";

export class IntegrationPgRepository implements IIntegrationRepository {
  async listProxyInstances() {
    return this.db.select().from(proxyInstances).orderBy(desc(proxyInstances.createdAt)).limit(100);
  }

  async listConnections() {
    return this.db.select().from(connections).orderBy(desc(connections.createdAt)).limit(100);
  }

  async listAccountProfiles() {
    return this.db
      .select()
      .from(accountProfiles)
      .orderBy(desc(accountProfiles.updatedAt))
      .limit(100);
  }

  constructor(private readonly db: PGDB) {}

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
    const [updated] = await this.db
      .update(proxyInstances)
      .set({
        credentialRef: input.credentialRef,
        name: input.name,
        healthStatus: input.healthStatus,
        capabilities: input.capabilities,
        metadata: input.metadata,
        updatedAt: new Date(),
      })
      .where(eq(proxyInstances.id, input.id))
      .returning();
    return updated;
  }

  async createProxyInstance(input: CreateProxyInstanceInput) {
    const values: typeof proxyInstances.$inferInsert = {
      id: input.id,
      ownerUserId: input.ownerUserId,
      provider: input.provider,
      baseUrl: input.baseUrl,
      credentialRef: input.credentialRef,
      name: input.name ?? null,
      status: input.status ?? "active",
      healthStatus: input.healthStatus ?? "healthy",
      capabilities: input.capabilities ?? null,
      metadata: input.metadata ?? null,
      lastSeenAt: input.lastSeenAt ?? undefined,
    };
    const [row] = await this.db.insert(proxyInstances).values(values).returning();
    return row;
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
      .set({ status: input.status, updatedAt: new Date() })
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
    const values: typeof connections.$inferInsert = {
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
}
