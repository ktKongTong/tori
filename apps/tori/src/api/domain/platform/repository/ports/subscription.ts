/* oxlint-disable typescript-eslint/no-redundant-type-constituents */

import type { JsonRecord } from "./common.ts";

export interface SubscriptionRow {
  id: string;
  channelId: string;
  botPluginInstanceId: string;
  connectionId: string;
  ownerType: string;
  ownerId: string;
  topicType: string;
  topicKey: string;
  eventTypes: string[];
  status: string;
  filterExpr: JsonRecord | null;
  createdByUserId: string | null;
  createdAt: Date;
  updatedAt: Date;
}

export interface ISubscriptionRepository {
  listSubscriptionsByConnectionId(connectionId: string): Promise<SubscriptionRow[]>;
  listActiveSubscriptionsByChannelId(channelId: string): Promise<SubscriptionRow[]>;
}
