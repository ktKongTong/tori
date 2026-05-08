import type {PageBasedPaginationResult} from "@repo/utils/schema/paging";
import type {User} from "@/api/domain/infra";
import type {Channel} from "./notify.ts";
import type {NotificationBody} from "@/api/modules/platform/notify/body.ts";

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
  channel?: Channel
  botPluginInstanceId: string;
  connection?: unknown;
  connectionId: string;
  owner?: User
  ownerType: string;
  ownerId: string;
  topicType: string;
  topicKey: string;
  eventTypes: string[];
  status: string;
  filterExpr: unknown;
  creator?: User | null;
  createdByUserId: string | null;
  createdAt: Date;
  updatedAt: Date;
}

export interface ISubscriptionRepository {
  listSubscriptions(): Promise<PageBasedPaginationResult<Subscription>>;
  findSubscriptionById(id: string): Promise<Subscription>;

  listSubscriptionsByConnectionId(connectionId: string): Promise<PageBasedPaginationResult<Subscription>>;
  listActiveSubscriptionsByChannelId(channelId: string): Promise<PageBasedPaginationResult<Subscription>>;
  listNotificationEventBySubscriptionId(subscription: string): Promise<PageBasedPaginationResult<NotificationEvent>>;

}
