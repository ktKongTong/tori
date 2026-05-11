export interface CreateSubscriptionInput {
  channelId: string;
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
  connectionId: string;
  ownerType: string;
  ownerId: string;
  topicType: string;
  topicKey: string;
  eventTypes: string[];
};
