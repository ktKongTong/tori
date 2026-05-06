import { and, eq, sql } from "drizzle-orm";
import { botPluginInstances, deliveryEndpoints } from "@/api/db/schema/pg";
import type { PGDB } from "@/api/domain/infra/db";
import type {
  CreateInternalDeliveryEndpointInput,
  CreateManagedBotInstanceInput,
  IBotPluginRepository,
} from "./repository";

export class BotPluginPgRepository implements IBotPluginRepository {
  constructor(private readonly db: PGDB) {}

  async listManagedBotInstances(ownerUserId: string) {
    return this.db
      .select()
      .from(botPluginInstances)
      .where(eq(botPluginInstances.ownerUserId, ownerUserId));
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
      .values(input as typeof deliveryEndpoints.$inferInsert)
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
      .values(input as typeof botPluginInstances.$inferInsert)
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
