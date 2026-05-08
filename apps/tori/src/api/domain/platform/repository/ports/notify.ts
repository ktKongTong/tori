import type { NotificationBody } from "@/api/modules/platform/notify/body.ts";
import type { ManagedBotPluginInstance } from "@/api/modules/platform/bot-plugin/repository";
import type { Connection } from "./connection.ts";
import type { Subscription } from "./subscription.ts";
import type { ChannelBinding } from "@/api/modules/platform/binding/repository";
import type {User} from "@/api/domain/infra";

export interface DeliveryEndpoint {
  id: string;
  ownerUserId: string | null;
  platform: string;
  kind: string;
  displayName: string | null;
  target: string;
  secret: string | null;
  status: string;
  config: unknown;
  metadata: unknown;
  lastUsedAt: Date | null;
  createdAt: Date;
  updatedAt: Date;
}

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

export interface Channel {
  id: string;
  type: string;
  name: string | null;
  status: string;
  metadata: unknown;
  createdByUserId: string | null;
  createdAt: Date;
  updatedAt: Date;
}

export type NotificationDeliveryCandidate = {
  notification: NotificationEvent;
  channelBinding: ChannelBinding | null;
  deliveryEndpoint: DeliveryEndpoint;
  ownerUserId: string | null;
};

export type SubscriptionDetail = Subscription & {
  channel: Channel | null;
  botInstance: ManagedBotPluginInstance | null;
  connection: Connection | null;
  ownerUser: User | null;
  ownerChannel: Channel | null;
};

export type NotificationEventJoinedRow = {
  event: NotificationEvent;
  subscription: Subscription | null;
  channel: Channel | null;
  botInstance: ManagedBotPluginInstance | null;
  endpoint: DeliveryEndpoint | null;
};

export type CreateNotificationCandidatesInput = {
  connectionId: string;
  topicType: string;
  eventType: string;
  title: string;
  body: NotificationBody;
  payload: unknown;
};

export interface CreateDeliveryEndpointInput {
  id?: string;
  ownerUserId?: string | null;
  platform: string;
  kind: string;
  target: string;
  displayName?: string | null;
  secret?: string | null;
  status?: string;
  config?: unknown;
  metadata?: unknown;
}

export interface CreateSubscriptionInput {
  id?: string;
  channelId: string;
  botPluginInstanceId: string;
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

export interface CreateNotificationEventInput {
  id?: string;
  subscriptionId?: string | null;
  channelId: string;
  botPluginInstanceId?: string | null;
  deliveryEndpointId?: string | null;
  channelBindingId?: string | null;
  title?: string | null;
  body: NotificationBody;
  payload: unknown;
  status?: string;
  sentAt?: Date;
  errorMessage?: string | null;
  createdAt?: Date;
}

export interface INotifyRepository {
  // listDeliveryEndpoints(): Promise<DeliveryEndpoint[]>;
  // listSubscriptions(): Promise<Subscription[]>;
  // listSubscriptionDetails(): Promise<SubscriptionDetail[]>;
  // getSubscriptionJoinedRowById(id: string): Promise<SubscriptionDetail | null>;
  // listNotificationEvents(): Promise<NotificationEvent[]>;
  // listNotificationEventJoinedRows(): Promise<NotificationEventJoinedRow[]>;
  // listNotificationEventsBySubscription(
  //   id: string,
  //   input: { page: number; pageSize: number },
  // ): Promise<{ events: NotificationEvent[]; total: number }>;
  // getSubscriptionById(id: string): Promise<Subscription | null>;
  createNotificationCandidates(
    input: CreateNotificationCandidatesInput,
  ): Promise<NotificationDeliveryCandidate[]>;
  findChannelById(id: string): Promise<Channel | null>;
  findUserById(id: string): Promise<User | null>;
  findBotPluginInstanceById(id: string): Promise<ManagedBotPluginInstance | null>;
  findDeliveryEndpointById(id: string): Promise<DeliveryEndpoint | null>;
  findDeliveryEndpointByTarget(target: string): Promise<DeliveryEndpoint | null>;
  findActiveDeliveryEndpointById(id: string): Promise<DeliveryEndpoint | null>;
  createDeliveryEndpoint(input: CreateDeliveryEndpointInput): Promise<DeliveryEndpoint>;
  findActiveChannelBindingByChannelId(channelId: string): Promise<ChannelBinding | null>;
  findSubscriptionIdentity(input: {
    channelId: string;
    connectionId: string;
    botPluginInstanceId: string;
    topicType: string;
    topicKey: string;
  }): Promise<Subscription | null>;
  createSubscription(input: CreateSubscriptionInput): Promise<Subscription>;
  updateDeliveryEndpointStatus(id: string, status: string): Promise<DeliveryEndpoint | null>;
  updateSubscriptionStatus(id: string, status: string): Promise<Subscription | null>;
  createNotificationEvent(input: CreateNotificationEventInput): Promise<NotificationEvent>;
  markNotificationFailed(id: string, errorMessage: string): Promise<void>;
  markNotificationSent(id: string): Promise<void>;
}
