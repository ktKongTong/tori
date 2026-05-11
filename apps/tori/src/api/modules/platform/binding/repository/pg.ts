import { and, desc, eq, isNull } from "drizzle-orm";
import {
  bindingGrants,
  claimSessions,
  subscriptions,
  user,
  userBindings,
  channelBindings,
} from "@/api/db/schema/pg";
import type { PGDB } from "@/api/domain/infra/db";
import type { CreateBindingGrantInput, IBindingRepository } from "./repository";
import { toPageResult } from "@repo/db/utils";
import { withPagination } from "@repo/db/utils/pg";
import type { PageBasedPaginationParam } from "@repo/utils/schema/paging";

export class BindingPgRepository implements IBindingRepository {
  constructor(private readonly db: PGDB) {}

  async listUserBindings(page: PageBasedPaginationParam) {
    const where = and(eq(userBindings.status, "active"), isNull(userBindings.deletedAt));
    const [data, total] = await Promise.all([
      withPagination(
        this.db
          .select()
          .from(userBindings)
          .where(where)
          .orderBy(desc(userBindings.createdAt))
          .$dynamic(),
        page,
      ),
      this.db.$count(userBindings, where),
    ]);
    return toPageResult(data, total, page);
  }

  async listChannelBindings(page: PageBasedPaginationParam) {
    const where = and(eq(channelBindings.status, "active"), isNull(channelBindings.deletedAt));
    const [data, total] = await Promise.all([
      withPagination(
        this.db
          .select()
          .from(channelBindings)
          .where(where)
          .orderBy(desc(channelBindings.createdAt))
          .$dynamic(),
        page,
      ),
      this.db.$count(channelBindings, where),
    ]);
    return toPageResult(data, total, page);
  }

  async listClaimSessions(page: PageBasedPaginationParam) {
    const [data, total] = await Promise.all([
      withPagination(
        this.db.select().from(claimSessions).orderBy(desc(claimSessions.createdAt)).$dynamic(),
        page,
      ),
      this.db.$count(claimSessions),
    ]);
    return toPageResult(data, total, page);
  }

  async createBindingGrant(input: CreateBindingGrantInput) {
    const [grant] = await this.db.insert(bindingGrants).values(input).returning();
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
      .where(and(eq(userBindings.id, bindingId), isNull(userBindings.deletedAt)))
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
        deletedAt: new Date(),
        updatedAt: new Date(),
      })
      .where(and(eq(userBindings.id, bindingId), isNull(userBindings.deletedAt)))
      .returning();
    return revoked;
  }

  async findChannelBindingById(bindingId: string) {
    const [binding] = await this.db
      .select()
      .from(channelBindings)
      .where(and(eq(channelBindings.id, bindingId), isNull(channelBindings.deletedAt)))
      .limit(1);
    return binding ?? null;
  }

  async revokeChannelBinding(bindingId: string) {
    const [revoked] = await this.db
      .update(channelBindings)
      .set({
        status: "revoked",
        revokedReason: "removed-by-user",
        suspendedReason: null,
        endedAt: new Date(),
        deletedAt: new Date(),
        updatedAt: new Date(),
      })
      .where(and(eq(channelBindings.id, bindingId), isNull(channelBindings.deletedAt)))
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
        suspendedReason: reason,
        updatedAt: new Date(),
      })
      .where(
        and(
          eq(channelBindings.botPluginInstanceId, botPluginInstanceId),
          eq(channelBindings.status, "active"),
          isNull(channelBindings.deletedAt),
        ),
      )
      .returning({ id: channelBindings.id });
    return rows.length;
  }

  async deleteChannelBindingsByBotPluginInstanceId(botPluginInstanceId: string) {
    const rows = await this.db
      .update(channelBindings)
      .set({
        deletedAt: new Date(),
        updatedAt: new Date(),
      })
      .where(
        and(
          eq(channelBindings.botPluginInstanceId, botPluginInstanceId),
          isNull(channelBindings.deletedAt),
        ),
      )
      .returning({ id: channelBindings.id });
    return rows.length;
  }
}
