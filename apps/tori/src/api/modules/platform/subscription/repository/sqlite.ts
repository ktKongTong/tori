import { and, count, eq, inArray, isNull, or } from "drizzle-orm";
import { channelBindings, notificationEvents, subscriptions } from "@/api/db/schema/d1";
import type { SqliteDB } from "@/api/domain/infra";
import { NotFoundError } from "@/api/domain/error";
import type {
  CreateSubscriptionInput,
  ISubscriptionRepository,
} from "@/api/modules/platform/subscription/repository/repository.ts";
import { toPageResult } from "@repo/db/utils";
import { withPagination } from "@repo/db/utils/sqlite";
import type { PageBasedPaginationParam } from "@repo/utils/schema/paging";

export class SubscriptionSqliteRepository implements ISubscriptionRepository {
  constructor(private readonly db: SqliteDB) {}

  private visibleToUserWhere(userId: string) {
    return and(
      isNull(subscriptions.deletedAt),
      or(
        and(eq(subscriptions.ownerType, "USER"), eq(subscriptions.ownerId, userId)),
        eq(subscriptions.createdByUserId, userId),
      ),
    );
  }

  async listSubscriptions(page: PageBasedPaginationParam) {
    const where = isNull(subscriptions.deletedAt);
    const [data, [{ value: total }]] = await Promise.all([
      withPagination(this.db.select().from(subscriptions).where(where).$dynamic(), page),
      this.db.select({ value: count() }).from(subscriptions).where(where),
    ]);
    return toPageResult(data, total ?? 0, page);
  }

  async listSubscriptionsForUser(userId: string, page: PageBasedPaginationParam) {
    const where = this.visibleToUserWhere(userId);
    const [data, [{ value: total }]] = await Promise.all([
      withPagination(this.db.select().from(subscriptions).where(where).$dynamic(), page),
      this.db.select({ value: count() }).from(subscriptions).where(where),
    ]);
    return toPageResult(data, total ?? 0, page);
  }

  async findSubscriptionById(id: string) {
    const [subscription] = await this.db
      .select()
      .from(subscriptions)
      .where(and(eq(subscriptions.id, id), isNull(subscriptions.deletedAt)))
      .limit(1);
    if (!subscription) throw new NotFoundError(`Subscription ${id} not found`);
    return subscription;
  }

  async findSubscriptionByIdForUser(id: string, userId: string) {
    const [subscription] = await this.db
      .select()
      .from(subscriptions)
      .where(and(eq(subscriptions.id, id), this.visibleToUserWhere(userId)))
      .limit(1);
    if (!subscription) throw new NotFoundError(`Subscription ${id} not found`);
    return subscription;
  }

  async listSubscriptionsByConnectionId(connectionId: string, page: PageBasedPaginationParam) {
    const where = and(
      eq(subscriptions.connectionId, connectionId),
      isNull(subscriptions.deletedAt),
    );
    const [data, [{ value: total }]] = await Promise.all([
      withPagination(this.db.select().from(subscriptions).where(where).$dynamic(), page),
      this.db.select({ value: count() }).from(subscriptions).where(where),
    ]);
    return toPageResult(data, total ?? 0, page);
  }

  async listActiveSubscriptionsByChannelId(channelId: string, page: PageBasedPaginationParam) {
    const where = and(eq(subscriptions.channelId, channelId), eq(subscriptions.status, "active"));
    const [data, [{ value: total }]] = await Promise.all([
      withPagination(this.db.select().from(subscriptions).where(where).$dynamic(), page),
      this.db.select({ value: count() }).from(subscriptions).where(where),
    ]);
    return toPageResult(data, total ?? 0, page);
  }

  async listNotificationEventBySubscriptionId(
    subscriptionId: string,
    page: PageBasedPaginationParam,
  ) {
    const where = eq(notificationEvents.subscriptionId, subscriptionId);
    const [data, [{ value: total }]] = await Promise.all([
      withPagination(this.db.select().from(notificationEvents).where(where).$dynamic(), page),
      this.db.select({ value: count() }).from(notificationEvents).where(where),
    ]);
    return toPageResult(data, total ?? 0, page);
  }

  async listSubscriptionsByConnectionIdLegacy(connectionId: string) {
    return this.db.select().from(subscriptions).where(eq(subscriptions.connectionId, connectionId));
  }

  async findActiveChannelBindingByChannelId(channelId: string) {
    const [channelBinding] = await this.db
      .select()
      .from(channelBindings)
      .where(and(eq(channelBindings.channelId, channelId), eq(channelBindings.status, "active")))
      .limit(1);
    return channelBinding ?? null;
  }

  async findSubscriptionIdentity(input: {
    channelId: string;
    connectionId: string;
    ownerType: string;
    ownerId: string;
    topicType: string;
    topicKey: string;
  }) {
    const [subscription] = await this.db
      .select()
      .from(subscriptions)
      .where(
        and(
          eq(subscriptions.channelId, input.channelId),
          eq(subscriptions.connectionId, input.connectionId),
          eq(subscriptions.ownerType, input.ownerType),
          eq(subscriptions.ownerId, input.ownerId),
          eq(subscriptions.topicType, input.topicType),
          eq(subscriptions.topicKey, input.topicKey),
        ),
      )
      .limit(1);
    return subscription ?? null;
  }

  async createSubscription(input: CreateSubscriptionInput) {
    const [subscription] = await this.db.insert(subscriptions).values(input).returning();
    return subscription;
  }

  async updateSubscriptionStatus(id: string, status: string) {
    const [updated] = await this.db
      .update(subscriptions)
      .set({ status, updatedAt: new Date() })
      .where(eq(subscriptions.id, id))
      .returning();
    return updated ?? null;
  }

  async disableActiveSubscriptionsByConnectionId(connectionId: string) {
    return this.db
      .update(subscriptions)
      .set({ status: "disabled", updatedAt: new Date() })
      .where(and(eq(subscriptions.connectionId, connectionId), eq(subscriptions.status, "active")))
      .returning();
  }

  async deleteSubscriptionsByConnectionId(connectionId: string) {
    const rows = await this.db
      .delete(subscriptions)
      .where(eq(subscriptions.connectionId, connectionId))
      .returning({ id: subscriptions.id });
    return rows.map((row) => row.id);
  }

  async deleteNotificationEventsBySubscriptionIds(subscriptionIds: string[]) {
    if (!subscriptionIds.length) return 0;
    const rows = await this.db
      .delete(notificationEvents)
      .where(inArray(notificationEvents.subscriptionId, subscriptionIds))
      .returning({ id: notificationEvents.id });
    return rows.length;
  }

  async deleteNotificationEventsByDeliveryEndpointId(deliveryEndpointId: string) {
    const rows = await this.db
      .delete(notificationEvents)
      .where(eq(notificationEvents.deliveryEndpointId, deliveryEndpointId))
      .returning({ id: notificationEvents.id });
    return rows.length;
  }
}
