import { and, count, desc, eq } from "drizzle-orm";
import { proxyInstances } from "@/api/db/schema/d1";
import type { SqliteDB } from "@/api/domain/infra";
import type {
  CreateProxyInstanceInput,
  IIntegrationRepository,
  UpdateProxyInstanceProbeInput,
  UpdateProxyInstanceRegistrationInput,
  UpdateProxyInstanceStatusInput,
} from "@/api/modules/platform/integration/repository/repository.ts";
import { toPageResult } from "@repo/db/utils";
import { withPagination } from "@repo/db/utils/sqlite";
import type { PageBasedPaginationParam } from "@repo/utils/schema/paging";

export class IntegrationSqliteRepository implements IIntegrationRepository {
  constructor(private readonly db: SqliteDB) {}

  async listProxyInstances(page: PageBasedPaginationParam) {
    const [data, [{ value: total }]] = await Promise.all([
      withPagination(
        this.db.select().from(proxyInstances).orderBy(desc(proxyInstances.createdAt)).$dynamic(),
        page,
      ),
      this.db.select({ value: count() }).from(proxyInstances),
    ]);
    return toPageResult(data, total ?? 0, page);
  }

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
    const [row] = await this.db
      .insert(proxyInstances)
      .values({
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
        lastSeenAt: input.lastSeenAt ?? null,
      })
      .returning();
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

  async deleteProxyInstance(input: { id: string; ownerUserId: string }) {
    const [deleted] = await this.db
      .delete(proxyInstances)
      .where(
        and(eq(proxyInstances.id, input.id), eq(proxyInstances.ownerUserId, input.ownerUserId)),
      )
      .returning();
    return deleted ?? null;
  }
}
