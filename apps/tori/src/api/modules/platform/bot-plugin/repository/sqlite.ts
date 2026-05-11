import { and, count, desc, eq, sql } from "drizzle-orm";
import { uniqueId } from "@repo/utils/id";
import { botPluginInstances, deliveryEndpoints } from "@/api/db/schema/d1";
import type { SqliteDB } from "@/api/domain/infra/db";
import type {
  CreateInternalDeliveryEndpointInput,
  CreateManagedBotInstanceInput,
  IBotPluginRepository,
} from "./repository";
import { toPageResult } from "@repo/db/utils";
import { withPagination } from "@repo/db/utils/sqlite";
import type { PageBasedPaginationParam } from "@repo/utils/schema/paging";

export class BotPluginSqliteRepository implements IBotPluginRepository {
  constructor(private readonly db: SqliteDB) {}

  async listManagedBotInstances(ownerUserId: string, page: PageBasedPaginationParam) {
    const where = eq(botPluginInstances.ownerUserId, ownerUserId);
    const [data, [{ value: total }]] = await Promise.all([
      withPagination(
        this.db
          .select()
          .from(botPluginInstances)
          .where(where)
          .orderBy(desc(botPluginInstances.createdAt))
          .$dynamic(),
        page,
      ),
      this.db.select({ value: count() }).from(botPluginInstances).where(where),
    ]);
    return toPageResult(data, total ?? 0, page);
  }

  async findActiveMockBotInstance() {
    const [activeMock] = await this.db
      .select()
      .from(botPluginInstances)
      .where(and(eq(botPluginInstances.platform, "mock"), eq(botPluginInstances.status, "active")))
      .limit(1);
    return activeMock ?? null;
  }

  async findManagedBotInstanceIdentity(input: {
    ownerUserId: string;
    platform: string;
    namespace: string;
    instanceKey: string;
  }) {
    const [instance] = await this.db
      .select()
      .from(botPluginInstances)
      .where(
        and(
          eq(botPluginInstances.ownerUserId, input.ownerUserId),
          eq(botPluginInstances.platform, input.platform),
          eq(botPluginInstances.namespace, input.namespace),
          eq(botPluginInstances.instanceKey, input.instanceKey),
        ),
      )
      .limit(1);
    return instance ?? null;
  }

  async createInternalDeliveryEndpoint(input: CreateInternalDeliveryEndpointInput) {
    const [endpoint] = await this.db
      .insert(deliveryEndpoints)
      .values({
        id: input.id ?? uniqueId(),
        ownerUserId: input.ownerUserId ?? null,
        platform: input.platform,
        kind: input.kind,
        target: input.target,
        displayName: input.displayName ?? null,
        secret: input.secret ?? null,
        status: input.status ?? "active",
        config: input.config ?? null,
        metadata: input.metadata ?? null,
      })
      .returning();
    return endpoint;
  }

  async updateManagedBotInstanceRegistration(input: {
    id: string;
    displayName?: string | null;
    capabilities?: Record<string, unknown> | null;
    credentialHash: string;
  }) {
    const [existing] = await this.db
      .select()
      .from(botPluginInstances)
      .where(eq(botPluginInstances.id, input.id))
      .limit(1);
    const [updated] = await this.db
      .update(botPluginInstances)
      .set({
        displayName: input.displayName ?? existing?.displayName ?? null,
        capabilities: input.capabilities ?? existing?.capabilities,
        metadata: {
          ...Object.assign({}, existing?.metadata),
          runtimeCredentialHash: input.credentialHash,
          credentialRotatedAt: new Date().toISOString(),
        },
        updatedAt: new Date(),
      })
      .where(eq(botPluginInstances.id, input.id))
      .returning();
    return updated;
  }

  async createManagedBotInstance(input: CreateManagedBotInstanceInput) {
    const [instance] = await this.db
      .insert(botPluginInstances)
      .values({
        id: input.id,
        ownerUserId: input.ownerUserId,
        platform: input.platform,
        namespace: input.namespace ?? null,
        instanceKey: input.instanceKey,
        displayName: input.displayName ?? null,
        callbackMode: input.callbackMode ?? "internal-sse",
        deliveryEndpointId: input.deliveryEndpointId ?? null,
        status: input.status ?? "active",
        capabilities: input.capabilities ?? null,
        metadata: input.metadata ?? null,
        lastSeenAt: input.lastSeenAt ?? null,
      })
      .returning();
    return instance;
  }

  async updateManagedBotInstance(input: {
    id: string;
    displayName?: string | null;
    capabilities?: Record<string, unknown> | null;
    status?: string | null;
  }) {
    const [updated] = await this.db
      .update(botPluginInstances)
      .set({
        displayName: input.displayName,
        capabilities: input.capabilities,
        status: input.status ?? undefined,
        updatedAt: new Date(),
      })
      .where(eq(botPluginInstances.id, input.id))
      .returning();
    return updated ?? null;
  }

  async findManagedBotInstanceById(id: string) {
    const [instance] = await this.db
      .select()
      .from(botPluginInstances)
      .where(eq(botPluginInstances.id, id))
      .limit(1);
    return instance ?? null;
  }

  async rotateManagedBotInstanceCredential(input: { id: string; credentialHash: string }) {
    const instance = await this.findManagedBotInstanceById(input.id);
    await this.db
      .update(botPluginInstances)
      .set({
        metadata: {
          ...Object.assign({}, instance?.metadata),
          runtimeCredentialHash: input.credentialHash,
          credentialRotatedAt: new Date().toISOString(),
        },
        updatedAt: new Date(),
      })
      .where(eq(botPluginInstances.id, input.id));
  }

  async findActiveManagedBotInstanceByCredentialHash(credentialHash: string) {
    const [instance] = await this.db
      .select()
      .from(botPluginInstances)
      .where(
        and(
          eq(botPluginInstances.status, "active"),
          eq(
            sql<string>`${botPluginInstances.metadata} ->> 'runtimeCredentialHash'`,
            credentialHash,
          ),
        ),
      )
      .limit(1);
    return instance ?? null;
  }

  async markManagedBotInstanceSeen(id: string) {
    const [updated] = await this.db
      .update(botPluginInstances)
      .set({
        lastSeenAt: new Date(),
        updatedAt: new Date(),
      })
      .where(eq(botPluginInstances.id, id))
      .returning();
    return updated;
  }

  async revokeManagedBotInstance(id: string) {
    const instance = await this.findManagedBotInstanceById(id);
    const [updated] = await this.db
      .update(botPluginInstances)
      .set({
        status: "revoked",
        metadata: {
          ...Object.assign({}, instance?.metadata),
          revokedAt: new Date().toISOString(),
        },
        updatedAt: new Date(),
      })
      .where(eq(botPluginInstances.id, id))
      .returning();
    return updated;
  }

  async deleteManagedBotInstance(id: string) {
    const [deleted] = await this.db
      .delete(botPluginInstances)
      .where(eq(botPluginInstances.id, id))
      .returning();
    return deleted ?? null;
  }

  async deleteDeliveryEndpoint(id: string) {
    const [deleted] = await this.db
      .delete(deliveryEndpoints)
      .where(eq(deliveryEndpoints.id, id))
      .returning();
    return deleted ?? null;
  }

  async attachManagedBotInstanceEndpoint(input: {
    id: string;
    deliveryEndpointId?: string | null;
  }) {
    const [updated] = await this.db
      .update(botPluginInstances)
      .set({
        deliveryEndpointId: input.deliveryEndpointId,
        updatedAt: new Date(),
      })
      .where(eq(botPluginInstances.id, input.id))
      .returning();
    return updated ?? null;
  }
}
