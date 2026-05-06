/* oxlint-disable typescript-eslint/no-redundant-type-constituents */

import type { NotificationBody } from "@/api/modules/platform/notify/body.ts";
import type { JsonRecord } from "./common.ts";
import type { SubscriptionRow } from "./subscription.ts";

export interface DeliveryEndpointRow {
  id: string;
  ownerUserId: string | null;
  platform: string;
  kind: string;
  displayName: string | null;
  target: string;
  secret: string | null;
  status: string;
  config: JsonRecord | null;
  metadata: JsonRecord | null;
  lastUsedAt: Date | null;
  createdAt: Date;
  updatedAt: Date;
}

export interface ChannelBindingRow {
  id: string;
  channelId: string;
  platform: string;
  externalChannelId: string;
  externalChannelName: string | null;
  namespace: string | null;
  botPluginInstanceId: string | null;
  source: string;
  assurance: string;
  establishedByGrantId: string | null;
  status: string;
  supersededByBindingId: string | null;
  revokedReason: string | null;
  metadata: JsonRecord | null;
  createdAt: Date;
  updatedAt: Date;
  endedAt: Date | null;
}

export interface NotificationEventRow {
  id: string;
  subscriptionId: string | null;
  channelId: string;
  botPluginInstanceId: string | null;
  deliveryEndpointId: string | null;
  channelBindingId: string | null;
  title: string | null;
  body: NotificationBody;
  payload: JsonRecord;
  status: string;
  sentAt: Date | null;
  failedAt: Date | null;
  errorMessage: string | null;
  createdAt: Date;
}

export type NotificationDeliveryCandidate = {
  notification: NotificationEventRow;
  channelBinding: ChannelBindingRow | null;
  deliveryEndpoint: DeliveryEndpointRow;
  ownerUserId: string | null;
};

export type CreateNotificationCandidatesInput = {
  connectionId: string;
  topicType: string;
  eventType: string;
  title: string;
  body: NotificationBody;
  payload: JsonRecord;
};

export interface CreateDeliveryEndpointInput {
  id: string;
  ownerUserId?: string | null;
  platform: string;
  kind: string;
  target: string;
  displayName?: string | null;
  secret?: string | null;
  status?: string;
  config?: JsonRecord | null;
  metadata?: JsonRecord | null;
  lastUsedAt?: Date | null;
}

export interface CreateSubscriptionInput {
  id: string;
  channelId: string;
  botPluginInstanceId: string;
  connectionId: string;
  ownerType: string;
  ownerId: string;
  topicType: string;
  topicKey: string;
  eventTypes: string[];
  status?: string;
  filterExpr?: JsonRecord | null;
  createdByUserId?: string | null;
}

export interface CreateNotificationEventInput {
  id: string;
  subscriptionId?: string | null;
  channelId: string;
  botPluginInstanceId?: string | null;
  deliveryEndpointId?: string | null;
  channelBindingId?: string | null;
  title?: string | null;
  body: NotificationBody;
  payload: JsonRecord;
  status?: string;
  sentAt?: Date | null;
  failedAt?: Date | null;
  errorMessage?: string | null;
  createdAt?: Date;
}

export interface INotifyRepository {
  createNotificationCandidates(
    input: CreateNotificationCandidatesInput,
  ): Promise<NotificationDeliveryCandidate[]>;
  findDeliveryEndpointByTarget(target: string): Promise<DeliveryEndpointRow | null>;
  findActiveDeliveryEndpointById(id: string): Promise<DeliveryEndpointRow | null>;
  createDeliveryEndpoint(input: CreateDeliveryEndpointInput): Promise<DeliveryEndpointRow>;
  findActiveChannelBindingByChannelId(channelId: string): Promise<ChannelBindingRow | null>;
  findSubscriptionIdentity(input: {
    channelId: string;
    connectionId: string;
    botPluginInstanceId: string;
    topicType: string;
    topicKey: string;
  }): Promise<SubscriptionRow | null>;
  createSubscription(input: CreateSubscriptionInput): Promise<SubscriptionRow>;
  updateDeliveryEndpointStatus(id: string, status: string): Promise<DeliveryEndpointRow | null>;
  updateSubscriptionStatus(id: string, status: string): Promise<SubscriptionRow | null>;
  createNotificationEvent(input: CreateNotificationEventInput): Promise<NotificationEventRow>;
  markNotificationFailed(id: string, errorMessage: string): Promise<void>;
  markNotificationSent(id: string): Promise<void>;
}
