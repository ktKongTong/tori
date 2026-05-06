import { and, eq } from "drizzle-orm";
import {
  bindingGrants,
  claimSessions,
  subscriptions,
  user,
  userBindings,
} from "@/api/db/schema/d1";
import type { SqliteDB } from "@/api/domain/infra/db";
import type { CreateBindingGrantInput, IBindingRepository } from "./repository";

export class BindingSqliteRepository implements IBindingRepository {
  constructor(private readonly db: SqliteDB) {}

  async createBindingGrant(input: CreateBindingGrantInput) {
    const [grant] = await this.db
      .insert(bindingGrants)
      .values(input as typeof bindingGrants.$inferInsert)
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
      .update(userBindings)
      .set({
        userId: input.authenticatedUserId,
        assurance: "token-confirmed",
        establishedByGrantId: input.grantId,
        updatedAt: new Date(),
      })
      .where(
        and(eq(userBindings.userId, input.anonymousUserId), eq(userBindings.status, "active")),
      );

    await this.db
      .update(subscriptions)
      .set({
        ownerId: input.authenticatedUserId,
        updatedAt: new Date(),
      })
      .where(
        and(eq(subscriptions.ownerType, "USER"), eq(subscriptions.ownerId, input.anonymousUserId)),
      );

    await this.db
      .update(bindingGrants)
      .set({
        status: "consumed",
        consumedAt: new Date(),
        usedCount: 1,
      })
      .where(eq(bindingGrants.id, input.grantId));

    const [resolved] = await this.db
      .update(claimSessions)
      .set({
        status: "resolved",
        resolution: input.resolution,
        resolvedAt: new Date(),
        resolvedUserId: input.authenticatedUserId,
      })
      .where(eq(claimSessions.id, input.claimSessionId))
      .returning();

    return resolved;
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
}
