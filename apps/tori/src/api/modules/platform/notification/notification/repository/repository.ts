import type { NotificationBody } from "../body.ts";
import type { ManagedBotPluginInstance } from "@/api/modules/platform/bot-plugin/repository";
import type { ChannelBinding } from "@/api/modules/platform/binding/repository";
import type { User } from "@/api/domain/infra";

export interface DeliveryEndpoint {
  id: string;
  ownerUserId: string | null;
  platform: string;
  kind: string;
  name: string | null;
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

export type CreateNotificationCandidatesInput = {
  connectionId: string;
  topicType: string;
  eventType: string;
  title: string;
  body: NotificationBody;
  payload: unknown;
};

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
  failedAt?: Date;
  errorMessage?: string | null;
  createdAt?: Date;
}

export interface INotifyRepository {
  createNotificationCandidates(
    input: CreateNotificationCandidatesInput,
  ): Promise<NotificationDeliveryCandidate[]>;
  findChannelById(id: string): Promise<Channel | null>;
  findUserById(id: string): Promise<User | null>;
  findBotPluginInstanceById(id: string): Promise<ManagedBotPluginInstance | null>;
  findActiveDeliveryEndpointById(id: string): Promise<DeliveryEndpoint | null>;
  createNotificationEvent(input: CreateNotificationEventInput): Promise<NotificationEvent>;
  markNotificationFailed(id: string, errorMessage: string): Promise<void>;
  markNotificationSent(id: string): Promise<void>;
}
