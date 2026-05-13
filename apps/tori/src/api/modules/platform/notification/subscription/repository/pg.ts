import { and, eq, aliasedTable, getColumns, inArray, isNull, or } from "drizzle-orm";
import {
  channelBindings,
  channels,
  connections,
  deliveryEndpoints,
  notificationEvents,
  subscriptions,
  user,
} from "@/api/db/schema/pg";
import type { PGDB } from "@/api/domain/infra";
import type {
  CreateSubscriptionInput,
  ISubscriptionRepository,
  Subscription,
} from "@/api/modules/platform/notification/subscription/repository/repository.ts";
import { toPageResult } from "@repo/db/utils";
import { withPagination } from "@repo/db/utils/pg";
import { NotFoundError } from "@/api/domain/error";
import type { PageBasedPaginationParam } from "@repo/utils/schema/paging";

export class SubscriptionPgRepository implements ISubscriptionRepository {
  constructor(private readonly db: PGDB) {}

  private visibleToUserWhere(userId: string) {
    return and(
      isNull(subscriptions.deletedAt),
      or(
        and(eq(subscriptions.ownerType, "USER"), eq(subscriptions.ownerId, userId)),
        eq(subscriptions.createdByUserId, userId),
      ),
    );
  }

  private buildListSubscriptions() {
    const owner = aliasedTable(user, "owner");
    const creator = aliasedTable(user, "creator");
    const query = this.db
      .select({
        ...getColumns(subscriptions),
        owner: owner,
        channel: channels,
        creator: creator,
        connection: connections,
      })
      .from(subscriptions)
      .leftJoin(channels, eq(subscriptions.channelId, channels.id))
      .leftJoin(connections, eq(subscriptions.connectionId, connections.id))
      .leftJoin(
        owner,
        and(eq(subscriptions.ownerType, "USER"), eq(subscriptions.ownerId, owner.id)),
      )
      .leftJoin(creator, eq(subscriptions.createdByUserId, creator.id))
      .where(isNull(subscriptions.deletedAt));

    return query.$dynamic();
  }
  async findSubscriptionById(id: string): Promise<Subscription> {
    const [query] = await this.buildListSubscriptions()
      .where(and(eq(subscriptions.id, id), isNull(subscriptions.deletedAt)))
      .limit(1);
    if (!query) throw new NotFoundError(`Subscription ${id} not found`);
    return query;
  }

  async findSubscriptionByIdForUser(id: string, userId: string): Promise<Subscription> {
    const [query] = await this.buildListSubscriptions()
      .where(and(eq(subscriptions.id, id), this.visibleToUserWhere(userId)))
      .limit(1);
    if (!query) throw new NotFoundError(`Subscription ${id} not found`);
    return query;
  }

  async listSubscriptions(page: PageBasedPaginationParam) {
    const query = this.buildListSubscriptions();
    const [data, total] = await Promise.all([
      withPagination(query.$dynamic(), page),
      this.db.$count(subscriptions, isNull(subscriptions.deletedAt)),
    ]);
    return toPageResult(data, total, page);
  }

  async listSubscriptionsForUser(userId: string, page: PageBasedPaginationParam) {
    const where = this.visibleToUserWhere(userId);
    const query = this.buildListSubscriptions().where(where);
    const [data, total] = await Promise.all([
      withPagination(query.$dynamic(), page),
      this.db.$count(subscriptions, where),
    ]);
    return toPageResult(data, total, page);
  }
  async listSubscriptionsByConnectionId(connectionId: string, page: PageBasedPaginationParam) {
    const where = and(
      eq(subscriptions.connectionId, connectionId),
      isNull(subscriptions.deletedAt),
    );
    const query = this.buildListSubscriptions().where(where);
    const [data, total] = await Promise.all([
      withPagination(query.$dynamic(), page),
      this.db.$count(subscriptions, where),
    ]);
    return toPageResult(data, total, page);
  }

  async listActiveSubscriptionsByChannelId(channelId: string, page: PageBasedPaginationParam) {
    const where = and(
      eq(subscriptions.channelId, channelId),
      eq(subscriptions.status, "active"),
      isNull(subscriptions.deletedAt),
    );
    const query = this.buildListSubscriptions().where(where);
    const [data, total] = await Promise.all([
      withPagination(query.$dynamic(), page),
      this.db.$count(subscriptions, where),
    ]);
    return toPageResult(data, total, page);
  }

  private buildListNotificationEvents() {
    const query = this.db
      .select({
        ...getColumns(notificationEvents),
        deliveryEndpoints: deliveryEndpoints,
        channelBindings: channelBindings,
      })
      .from(notificationEvents)
      .innerJoin(deliveryEndpoints, eq(notificationEvents.deliveryEndpointId, deliveryEndpoints.id))
      .innerJoin(channelBindings, eq(notificationEvents.channelBindingId, channelBindings.id));

    return query;
  }
  async listNotificationEventBySubscriptionId(
    subscriptionId: string,
    page: PageBasedPaginationParam,
  ) {
    const where = eq(notificationEvents.subscriptionId, subscriptionId);
    const query = this.buildListNotificationEvents().where(where);
    const [data, total] = await Promise.all([
      withPagination(query.$dynamic(), page),
      this.db.$count(notificationEvents, where),
    ]);
    return toPageResult(data, total, page);
  }

  async findActiveChannelBindingByChannelId(channelId: string) {
    const [channelBinding] = await this.db
      .select()
      .from(channelBindings)
      .where(
        and(
          eq(channelBindings.channelId, channelId),
          eq(channelBindings.status, "active"),
          isNull(channelBindings.deletedAt),
        ),
      )
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
          isNull(subscriptions.deletedAt),
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
      .where(and(eq(subscriptions.id, id), isNull(subscriptions.deletedAt)))
      .returning();
    return updated ?? null;
  }

  async disableActiveSubscriptionsByConnectionId(connectionId: string) {
    return this.db
      .update(subscriptions)
      .set({ status: "disabled", updatedAt: new Date() })
      .where(
        and(
          eq(subscriptions.connectionId, connectionId),
          eq(subscriptions.status, "active"),
          isNull(subscriptions.deletedAt),
        ),
      )
      .returning();
  }

  async deleteSubscriptionsByConnectionId(connectionId: string) {
    const rows = await this.db
      .update(subscriptions)
      .set({ deletedAt: new Date(), updatedAt: new Date() })
      .where(and(eq(subscriptions.connectionId, connectionId), isNull(subscriptions.deletedAt)))
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
