import type {
  PageBasedPaginationParam,
  PageBasedPaginationResult,
} from "@repo/utils/schema/paging";
import type { User } from "@/api/domain/infra";
import type { Channel } from "../../notification/repository/repository.ts";
import type { NotificationBody } from "../../notification/body.ts";
import type { ChannelBinding } from "@/api/modules/platform/binding/repository";

export interface NotificationEvent {
  id: string;
  subscriptionId: string | null;
  channelId: string;
  botPluginInstanceId: string | null;
  deliveryEndpointId: string | null;
  channelBindingId: string | null;
  title: string | null;
  body: NotificationBody;
  payload: unknown;
  status: string;
  sentAt: Date | null;
  failedAt: Date | null;
  errorMessage: string | null;
  createdAt: Date;
}

export interface Subscription {
  id: string;
  channelId: string;
  channel?: Channel | null;
  connection?: unknown;
  connectionId: string;
  owner?: User | null;
  ownerType: string;
  ownerId: string;
  topicType: string;
  topicKey: string;
  eventTypes: string[];
  status: string;
  filterExpr: unknown;
  creator?: User | null;
  createdByUserId: string | null;
  deletedAt: Date | null;
  createdAt: Date;
  updatedAt: Date;
}

export interface CreateSubscriptionInput {
  id?: string;
  channelId: string;
  connectionId: string;
  ownerType: string;
  ownerId: string;
  topicType: string;
  topicKey: string;
  eventTypes: string[];
  status?: string;
  filterExpr?: unknown;
  createdByUserId?: string | null;
}

export interface ISubscriptionRepository {
  listSubscriptions(
    page: PageBasedPaginationParam,
  ): Promise<PageBasedPaginationResult<Subscription>>;
  listSubscriptionsForUser(
    userId: string,
    page: PageBasedPaginationParam,
  ): Promise<PageBasedPaginationResult<Subscription>>;
  findSubscriptionById(id: string): Promise<Subscription>;
  findSubscriptionByIdForUser(id: string, userId: string): Promise<Subscription>;

  listSubscriptionsByConnectionId(
    connectionId: string,
    page: PageBasedPaginationParam,
  ): Promise<PageBasedPaginationResult<Subscription>>;
  listActiveSubscriptionsByChannelId(
    channelId: string,
    page: PageBasedPaginationParam,
  ): Promise<PageBasedPaginationResult<Subscription>>;
  listNotificationEventBySubscriptionId(
    subscription: string,
    page: PageBasedPaginationParam,
  ): Promise<PageBasedPaginationResult<NotificationEvent>>;
  findActiveChannelBindingByChannelId(channelId: string): Promise<ChannelBinding | null>;
  findSubscriptionIdentity(input: {
    channelId: string;
    connectionId: string;
    ownerType: string;
    ownerId: string;
    topicType: string;
    topicKey: string;
  }): Promise<Subscription | null>;
  createSubscription(input: CreateSubscriptionInput): Promise<Subscription>;
  updateSubscriptionStatus(id: string, status: "active" | "disabled"): Promise<Subscription | null>;
  disableActiveSubscriptionsByConnectionId(connectionId: string): Promise<Subscription[]>;
  deleteSubscriptionsByConnectionId(connectionId: string): Promise<string[]>;
  deleteNotificationEventsBySubscriptionIds(subscriptionIds: string[]): Promise<number>;
  deleteNotificationEventsByDeliveryEndpointId(deliveryEndpointId: string): Promise<number>;
}
