import { and, desc, eq, sql, isNull } from "drizzle-orm";
import { botPluginInstances, deliveryEndpoints } from "@/api/db/schema/pg";
import type { PGDB } from "@/api/domain/infra/db";
import type {
  CreateInternalDeliveryEndpointInput,
  CreateManagedBotInstanceInput,
  IBotPluginRepository,
} from "./repository";
import { uniqueId } from "@repo/utils/id";
import { toPageResult } from "@repo/db/utils";
import { withPagination } from "@repo/db/utils/pg";
import type { PageBasedPaginationParam } from "@repo/utils/schema/paging";

export class BotPluginPgRepository implements IBotPluginRepository {
  constructor(private readonly db: PGDB) {}

  async listManagedBotInstances(ownerUserId: string, page: PageBasedPaginationParam) {
    const where = and(
      eq(botPluginInstances.ownerUserId, ownerUserId),
      isNull(botPluginInstances.deletedAt),
    );
    const [data, total] = await Promise.all([
      withPagination(
        this.db
          .select()
          .from(botPluginInstances)
          .where(where)
          .orderBy(desc(botPluginInstances.createdAt))
          .$dynamic(),
        page,
      ),
      this.db.$count(botPluginInstances, where),
    ]);
    return toPageResult(data, total, page);
  }

  async listVisibleManagedBotInstances(
    input: { ownerUserId: string; includeAll?: boolean },
    page: PageBasedPaginationParam,
  ) {
    void input;
    const where = isNull(botPluginInstances.deletedAt);
    const [data, total] = await Promise.all([
      withPagination(
        this.db
          .select()
          .from(botPluginInstances)
          .where(where)
          .orderBy(desc(botPluginInstances.createdAt))
          .$dynamic(),
        page,
      ),
      this.db.$count(botPluginInstances, where),
    ]);
    return toPageResult(data, total, page);
  }

  async findActivePlaygroundBotInstance() {
    const [activeMock] = await this.db
      .select()
      .from(botPluginInstances)
      .where(
        and(
          eq(botPluginInstances.platform, "playground"),
          eq(botPluginInstances.status, "active"),
          isNull(botPluginInstances.deletedAt),
        ),
      )
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
          isNull(botPluginInstances.deletedAt),
        ),
      )
      .limit(1);
    return instance ?? null;
  }

  async createInternalDeliveryEndpoint(input: CreateInternalDeliveryEndpointInput) {
    const values: typeof deliveryEndpoints.$inferInsert = {
      id: uniqueId(),
      ownerUserId: input.ownerUserId ?? null,
      platform: input.platform,
      kind: input.kind,
      target: input.target,
      name: input.name ?? null,
      secret: input.secret ?? null,
      status: input.status ?? "active",
      config: input.config ?? null,
      metadata: input.metadata ?? null,
    };
    const [endpoint] = await this.db.insert(deliveryEndpoints).values(values).returning();
    return endpoint;
  }

  async updateManagedBotInstanceRegistration(input: {
    id: string;
    name?: string | null;
    capabilities?: Record<string, unknown> | null;
    credentialHash: string;
  }) {
    const [existing] = await this.db
      .select()
      .from(botPluginInstances)
      .where(and(eq(botPluginInstances.id, input.id), isNull(botPluginInstances.deletedAt)))
      .limit(1);
    const [updated] = await this.db
      .update(botPluginInstances)
      .set({
        name: input.name ?? existing?.name ?? null,
        capabilities: input.capabilities ?? existing?.capabilities,
        metadata: {
          ...Object.assign({}, existing?.metadata),
          runtimeCredentialHash: input.credentialHash,
          credentialRotatedAt: new Date().toISOString(),
        },
        updatedAt: new Date(),
      })
      .where(and(eq(botPluginInstances.id, input.id), isNull(botPluginInstances.deletedAt)))
      .returning();
    return updated;
  }

  async createManagedBotInstance(input: CreateManagedBotInstanceInput) {
    const values: typeof botPluginInstances.$inferInsert = {
      id: input.id,
      ownerUserId: input.ownerUserId,
      platform: input.platform,
      namespace: input.namespace ?? null,
      instanceKey: input.instanceKey,
      name: input.name,
      callbackMode: input.callbackMode ?? "internal-sse",
      deliveryEndpointId: input.deliveryEndpointId ?? null,
      status: input.status ?? "active",
      capabilities: input.capabilities ?? null,
      metadata: input.metadata ?? null,
      lastSeenAt: input.lastSeenAt ?? undefined,
    };
    const [instance] = await this.db.insert(botPluginInstances).values(values).returning();
    return instance;
  }

  async updateManagedBotInstance(input: {
    id: string;
    name: string;
    capabilities?: Record<string, unknown> | null;
    status?: "active" | "disabled" | null;
  }) {
    const [updated] = await this.db
      .update(botPluginInstances)
      .set({
        name: input.name,
        capabilities: input.capabilities,
        status: input.status ?? undefined,
        updatedAt: new Date(),
      })
      .where(and(eq(botPluginInstances.id, input.id), isNull(botPluginInstances.deletedAt)))
      .returning();
    return updated ?? null;
  }

  async findManagedBotInstanceById(id: string) {
    const [instance] = await this.db
      .select()
      .from(botPluginInstances)
      .where(and(eq(botPluginInstances.id, id), isNull(botPluginInstances.deletedAt)))
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
      .where(and(eq(botPluginInstances.id, input.id), isNull(botPluginInstances.deletedAt)));
  }

  async findActiveManagedBotInstanceByCredentialHash(credentialHash: string) {
    const [instance] = await this.db
      .select()
      .from(botPluginInstances)
      .where(
        and(
          eq(botPluginInstances.status, "active"),
          isNull(botPluginInstances.deletedAt),
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
      .where(and(eq(botPluginInstances.id, id), isNull(botPluginInstances.deletedAt)))
      .returning();
    return updated;
  }

  async revokeManagedBotInstance(id: string) {
    const instance = await this.findManagedBotInstanceById(id);
    const [updated] = await this.db
      .update(botPluginInstances)
      .set({
        status: "revoked",
        deletedAt: new Date(),
        metadata: {
          ...Object.assign({}, instance?.metadata),
          revokedAt: new Date().toISOString(),
        },
        updatedAt: new Date(),
      })
      .where(and(eq(botPluginInstances.id, id), isNull(botPluginInstances.deletedAt)))
      .returning();
    return updated;
  }

  async deleteManagedBotInstance(id: string) {
    const [deleted] = await this.db
      .update(botPluginInstances)
      .set({
        deletedAt: new Date(),
        metadata: sql`coalesce(${botPluginInstances.metadata}, '{}'::jsonb) || jsonb_build_object('deletedAt', ${new Date().toISOString()}, 'runtimeCredentialHash', null)`,
        updatedAt: new Date(),
      })
      .where(and(eq(botPluginInstances.id, id), isNull(botPluginInstances.deletedAt)))
      .returning();
    return deleted ?? null;
  }

  async deleteDeliveryEndpoint(id: string) {
    const [deleted] = await this.db
      .update(deliveryEndpoints)
      .set({ deletedAt: new Date(), updatedAt: new Date() })
      .where(and(eq(deliveryEndpoints.id, id), isNull(deliveryEndpoints.deletedAt)))
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
      .where(and(eq(botPluginInstances.id, input.id), isNull(botPluginInstances.deletedAt)))
      .returning();
    return updated ?? null;
  }
}
