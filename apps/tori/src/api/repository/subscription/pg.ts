import { and, eq } from "drizzle-orm";
import { subscriptions } from "@/api/db/schema/pg";
import type { PGDB } from "@/api/domain/infra";
import type { ISubscriptionRepository } from "@/api/domain/platform/repository/ports/subscription.ts";

export class SubscriptionPgRepository implements ISubscriptionRepository {
  constructor(private readonly db: PGDB) {}

  async listSubscriptionsByConnectionId(connectionId: string) {
    return await this.db
      .select()
      .from(subscriptions)
      .where(eq(subscriptions.connectionId, connectionId));
  }

  async listActiveSubscriptionsByChannelId(channelId: string) {
    return await this.db
      .select()
      .from(subscriptions)
      .where(and(eq(subscriptions.channelId, channelId), eq(subscriptions.status, "active")));
  }
}
