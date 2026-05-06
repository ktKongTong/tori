export interface RegisterDeliveryEndpointInput {
  platform: string;
  kind: string;
  target: string;
  displayName?: string | null;
  secret?: string | null;
  config?: Record<string, unknown> | null;
  metadata?: Record<string, unknown> | null;
}

export interface CreateSubscriptionInput {
  channelId: string;
  botPluginInstanceId?: string;
  connectionId: string;
  ownerType: "USER" | "CHANNEL";
  ownerId?: string;
  topicType: string;
  topicKey: string;
  eventTypes: string[];
  filterExpr?: Record<string, unknown> | null;
}

export const SUBSCRIPTION_CREATED = "SubscriptionCreated";
export const SUBSCRIPTION_ACTIVATED = "SubscriptionActivated";

export type SubscriptionLifecyclePayload = {
  subscriptionId: string;
  channelId: string;
  botPluginInstanceId: string | null;
  connectionId: string;
  ownerType: string;
  ownerId: string;
  topicType: string;
  topicKey: string;
  eventTypes: string[];
};
