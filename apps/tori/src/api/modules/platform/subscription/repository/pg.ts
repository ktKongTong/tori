import { and, eq, aliasedTable, getColumns } from "drizzle-orm";
import {
  botPluginInstances,
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
} from "@/api/modules/platform/subscription/repository/repository.ts";
import { toPageResult } from "@repo/db/utils";
import { withPagination } from "@repo/db/utils/pg";
import { NotFoundError } from "@/api/domain/error";
import type { PageBasedPaginationParam } from "@repo/utils/schema/paging";

export class SubscriptionPgRepository implements ISubscriptionRepository {
  constructor(private readonly db: PGDB) {}

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
        botInstance: botPluginInstances,
      })
      .from(subscriptions)
      .leftJoin(channels, eq(subscriptions.channelId, channels.id))
      .leftJoin(connections, eq(subscriptions.connectionId, connections.id))
      .leftJoin(botPluginInstances, eq(subscriptions.botPluginInstanceId, botPluginInstances.id))
      .leftJoin(
        owner,
        and(eq(subscriptions.ownerType, "USER"), eq(subscriptions.ownerId, owner.id)),
      )
      .leftJoin(creator, eq(subscriptions.createdByUserId, creator.id));

    return query;
  }
  async findSubscriptionById(id: string): Promise<Subscription> {
    const [query] = await this.buildListSubscriptions().where(eq(subscriptions.id, id)).limit(1);
    if (!query) throw new NotFoundError(`Subscription ${id} not found`);
    return query;
  }

  async listSubscriptions(page: PageBasedPaginationParam) {
    const query = this.buildListSubscriptions();
    const [data, total] = await Promise.all([
      withPagination(query.$dynamic(), page),
      this.db.$count(subscriptions),
    ]);
    return toPageResult(data, total, page);
  }
  async listSubscriptionsByConnectionId(connectionId: string, page: PageBasedPaginationParam) {
    const query = this.buildListSubscriptions().where(eq(subscriptions.connectionId, connectionId));
    const [data, total] = await Promise.all([
      withPagination(query.$dynamic(), page),
      this.db.$count(subscriptions, eq(subscriptions.connectionId, connectionId)),
    ]);
    return toPageResult(data, total, page);
  }

  async listActiveSubscriptionsByChannelId(channelId: string, page: PageBasedPaginationParam) {
    const where = and(eq(subscriptions.channelId, channelId), eq(subscriptions.status, "active"));
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
      .where(and(eq(channelBindings.channelId, channelId), eq(channelBindings.status, "active")))
      .limit(1);
    return channelBinding ?? null;
  }

  async findSubscriptionIdentity(input: {
    channelId: string;
    connectionId: string;
    botPluginInstanceId: string;
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
          eq(subscriptions.botPluginInstanceId, input.botPluginInstanceId),
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
}
