import { and, count, desc, eq } from "drizzle-orm";
import {
  bindingGrants,
  claimSessions,
  subscriptions,
  user,
  userBindings,
  channelBindings,
} from "@/api/db/schema/d1";
import type { SqliteDB } from "@/api/domain/infra/db";
import type { CreateBindingGrantInput, IBindingRepository } from "./repository";
import { uniqueId } from "@repo/utils/id";
import { toPageResult } from "@repo/db/utils";
import { withPagination } from "@repo/db/utils/sqlite";
import type { PageBasedPaginationParam } from "@repo/utils/schema/paging";

export class BindingSqliteRepository implements IBindingRepository {
  constructor(private readonly db: SqliteDB) {}

  async listUserBindings(page: PageBasedPaginationParam) {
    const where = eq(userBindings.status, "active");
    const [data, [{ value: total }]] = await Promise.all([
      withPagination(
        this.db
          .select()
          .from(userBindings)
          .where(where)
          .orderBy(desc(userBindings.createdAt))
          .$dynamic(),
        page,
      ),
      this.db.select({ value: count() }).from(userBindings).where(where),
    ]);
    return toPageResult(data, total ?? 0, page);
  }

  async listChannelBindings(page: PageBasedPaginationParam) {
    const where = eq(channelBindings.status, "active");
    const [data, [{ value: total }]] = await Promise.all([
      withPagination(
        this.db
          .select()
          .from(channelBindings)
          .where(where)
          .orderBy(desc(channelBindings.createdAt))
          .$dynamic(),
        page,
      ),
      this.db.select({ value: count() }).from(channelBindings).where(where),
    ]);
    return toPageResult(data, total ?? 0, page);
  }

  async listClaimSessions(page: PageBasedPaginationParam) {
    const [data, [{ value: total }]] = await Promise.all([
      withPagination(
        this.db.select().from(claimSessions).orderBy(desc(claimSessions.createdAt)).$dynamic(),
        page,
      ),
      this.db.select({ value: count() }).from(claimSessions),
    ]);
    return toPageResult(data, total ?? 0, page);
  }

  async createBindingGrant(input: CreateBindingGrantInput) {
    const id = uniqueId();
    const [grant] = await this.db
      .insert(bindingGrants)
      .values({
        ...input,
        id,
      })
      .returning();
    return grant;
  }

  async findPendingBindingGrantByTokenHash(tokenHash: string) {
    const [grant] = await this.db
      .select()
      .from(bindingGrants)
      .where(and(eq(bindingGrants.tokenHash, tokenHash), eq(bindingGrants.status, "pending")))
      .limit(1);
    return grant ?? null;
  }

  async findClaimSessionByGrantId(grantId: string) {
    const [claimSession] = await this.db
      .select()
      .from(claimSessions)
      .where(eq(claimSessions.grantId, grantId))
      .limit(1);
    return claimSession ?? null;
  }

  async findUserById(userId: string) {
    const [row] = await this.db.select().from(user).where(eq(user.id, userId)).limit(1);
    return row ?? null;
  }

  async resolveAnonymousClaim(input: {
    grantId: string;
    claimSessionId: string;
    anonymousUserId: string;
    authenticatedUserId: string;
    resolution: string;
  }) {
    await this.db
      .update(user)
      .set({
        isAnonymous: false,
        claimedAt: new Date(),
        mergedIntoUserId: input.resolution === "merged" ? input.authenticatedUserId : null,
        updatedAt: new Date(),
      })
      .where(eq(user.id, input.anonymousUserId));

    await this.db
      .update(claimSessions)
      .set({
        status: "resolved",
        resolvedUserId: input.authenticatedUserId,
        resolution: input.resolution,
        resolvedAt: new Date(),
        updatedAt: new Date(),
      })
      .where(eq(claimSessions.id, input.claimSessionId));

    await this.db
      .update(subscriptions)
      .set({
        ownerId: input.authenticatedUserId,
        createdByUserId: input.authenticatedUserId,
        updatedAt: new Date(),
      })
      .where(eq(subscriptions.ownerId, input.anonymousUserId));

    await this.db
      .update(userBindings)
      .set({
        userId: input.authenticatedUserId,
        updatedAt: new Date(),
      })
      .where(eq(userBindings.userId, input.anonymousUserId));

    await this.db
      .update(bindingGrants)
      .set({
        status: "consumed",
        consumedAt: new Date(),
        updatedAt: new Date(),
      })
      .where(eq(bindingGrants.id, input.grantId));
  }

  async findUserBindingById(bindingId: string) {
    const [binding] = await this.db
      .select()
      .from(userBindings)
      .where(eq(userBindings.id, bindingId))
      .limit(1);
    return binding ?? null;
  }

  async revokeUserBinding(bindingId: string) {
    const [revoked] = await this.db
      .update(userBindings)
      .set({
        status: "revoked",
        revokedReason: "removed-by-user",
        endedAt: new Date(),
        updatedAt: new Date(),
      })
      .where(eq(userBindings.id, bindingId))
      .returning();
    return revoked;
  }

  async findChannelBindingById(bindingId: string) {
    const [binding] = await this.db
      .select()
      .from(channelBindings)
      .where(eq(channelBindings.id, bindingId))
      .limit(1);
    return binding ?? null;
  }

  async revokeChannelBinding(bindingId: string) {
    const [revoked] = await this.db
      .update(channelBindings)
      .set({
        status: "revoked",
        revokedReason: "removed-by-user",
        endedAt: new Date(),
        updatedAt: new Date(),
      })
      .where(eq(channelBindings.id, bindingId))
      .returning();
    return revoked;
  }

  async suspendActiveChannelBindingsByBotPluginInstanceId(
    botPluginInstanceId: string,
    reason: string,
  ) {
    const rows = await this.db
      .update(channelBindings)
      .set({
        status: "suspended",
        revokedReason: reason,
        updatedAt: new Date(),
      })
      .where(
        and(
          eq(channelBindings.botPluginInstanceId, botPluginInstanceId),
          eq(channelBindings.status, "active"),
        ),
      )
      .returning({ id: channelBindings.id });
    return rows.length;
  }

  async deleteChannelBindingsByBotPluginInstanceId(botPluginInstanceId: string) {
    const rows = await this.db
      .delete(channelBindings)
      .where(eq(channelBindings.botPluginInstanceId, botPluginInstanceId))
      .returning({ id: channelBindings.id });
    return rows.length;
  }
}
