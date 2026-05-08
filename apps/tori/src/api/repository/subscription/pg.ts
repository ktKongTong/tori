import {and, eq, aliasedTable, getColumns} from "drizzle-orm";
import { subscriptions, user, channels, connections, notificationEvents, deliveryEndpoints, channelBindings } from "@/api/db/schema/pg";
import type { PGDB } from "@/api/domain/infra";
import type {ISubscriptionRepository, Subscription} from "@/api/domain/platform/repository/ports/subscription.ts";
import {toPageResult} from "@repo/db/utils";
import { withPagination } from "@repo/db/utils/pg";
import {NotFoundError} from "@/api/domain/error";

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
      })
      .from(subscriptions)
      .innerJoin(channels, eq(subscriptions.channelId, channels.id))
      .innerJoin(connections, eq(subscriptions.connectionId, subscriptions.connectionId))
      .innerJoin(owner, and(
        eq(subscriptions.ownerType, 'USER'),
        eq(subscriptions.ownerId, owner.id),
      ))
      .leftJoin(creator, eq(subscriptions.createdByUserId, creator.id))

    return query;
  }
  async findSubscriptionById(id: string): Promise<Subscription> {
    const [query] = await this
      .buildListSubscriptions()
      .where(eq(subscriptions.id, id)).limit(1);
    if (!query) throw new NotFoundError(`Subscription ${id} not found`);
    return query
  }

  async listSubscriptions() {
    const query = this
      .buildListSubscriptions()
    const page = {page: 1, pageSize: 20}
    const [data, total] = await Promise.all([
      withPagination(query.$dynamic(), page),
      this.db
        .$count(subscriptions)
    ])
    return toPageResult(data, total, page);
  }
  async listSubscriptionsByConnectionId(connectionId: string) {
    const query = this
      .buildListSubscriptions()
      .where(eq(subscriptions.connectionId, connectionId));
    const page = {page: 1, pageSize: 20}
    const [data, total] = await Promise.all([
      withPagination(query.$dynamic(), page),
      this.db
        .$count(subscriptions, eq(subscriptions.connectionId, connectionId))
    ])
    return toPageResult(data, total, page);
  }

  async listActiveSubscriptionsByChannelId(channelId: string) {
    const where = and(eq(subscriptions.channelId, channelId), eq(subscriptions.status, "active"))
    const query = this
      .buildListSubscriptions()
      .where(where);
    const page = {page: 1, pageSize: 20}
    const [data, total] = await Promise.all([
      withPagination(query.$dynamic(), page),
      this.db
        .$count(subscriptions, where)
    ])
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
      .innerJoin(channelBindings, eq(notificationEvents.channelBindingId, channelBindings.id))

    return query;
  }
  async listNotificationEventBySubscriptionId(subscriptionId: string) {
    const where = eq(notificationEvents.subscriptionId, subscriptionId)
    const query = this
      .buildListNotificationEvents()
      .where(where);
    const page = {page: 1, pageSize: 20}
    const [data, total] = await Promise.all([
      withPagination(query.$dynamic(), page),
      this.db
        .$count(notificationEvents, where)
    ])
    return toPageResult(data, total, page);
  }
}
