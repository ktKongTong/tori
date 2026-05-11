import type { ResolvedSubscriptionTarget } from "../commands/subscription-targets";

export type Json = unknown;

export interface BotIngressBindingGrantRow {
  id: string;
  code: string;
  tokenHash: string;
  purpose: string;
  subjectType: string;
  subjectId: string;
  issuedByUserId: string | null;
  issuedFrom: string;
  issuedToSurface: string;
  status: string;
  codeExpiresAt: Date;
  tokenExpiresAt: Date;
  consumedAt: Date | null;
  maxUses: number;
  usedCount: number;
  metadata: unknown;
  createdAt: Date;
  updatedAt: Date;
}

export interface BotIngressBotPluginInstanceRow {
  id: string;
  ownerUserId: string;
  platform: string;
  namespace: string | null;
  instanceKey: string;
  displayName: string | null;
  callbackMode: string;
  deliveryEndpointId: string | null;
  status: string;
  capabilities: unknown;
  metadata: unknown;
  lastSeenAt: Date | null;
  createdAt: Date;
  updatedAt: Date;
}

export interface BotIngressChannelBindingRow {
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
  suspendedReason: string | null;
  metadata: unknown;
  createdAt: Date;
  updatedAt: Date;
  endedAt: Date | null;
}

export interface BotIngressChannelRow {
  id: string;
  type: string;
  name: string | null;
  status: string;
  metadata: unknown;
  createdByUserId: string | null;
  createdAt: Date;
  updatedAt: Date;
}

export interface BotIngressClaimSessionRow {
  id: string;
  initiatedFrom: string;
  purpose: string;
  subjectType: string;
  subjectId: string | null;
  anonymousUserId: string | null;
  anonymousUserName: string | null;
  observedUserPlatform: string | null;
  observedUserId: string | null;
  observedUserName: string | null;
  observedUserNamespace: string | null;
  observedChannelPlatform: string | null;
  observedChannelId: string | null;
  observedChannelName: string | null;
  observedChannelNamespace: string | null;
  grantId: string | null;
  status: string;
  resolvedUserId: string | null;
  resolvedChannelId: string | null;
  resolution: string | null;
  metadata: unknown;
  createdAt: Date;
  updatedAt: Date;
  resolvedAt: Date | null;
}

export interface BotIngressConnectionRow {
  id: string;
  ownerUserId: string;
  proxyInstanceId: string | null;
  provider: string;
  providerAccountId: string;
  providerAccountName: string | null;
  providerAccountAvatar: string | null;
  accessMode: string;
  status: string;
  isDefault: boolean;
  metadata: unknown;
  connectedAt: Date;
  lastSyncedAt: Date | null;
  createdAt: Date;
  updatedAt: Date;
}

export interface BotIngressSubscriptionRow {
  id: string;
  channelId: string;
  connectionId: string;
  ownerType: string;
  ownerId: string;
  topicType: string;
  topicKey: string;
  eventTypes: string[];
  status: string;
  filterExpr: unknown;
  createdByUserId: string | null;
  createdAt: Date;
  updatedAt: Date;
}

export interface BotIngressUserRow {
  id: string;
  name: string;
  email: string;
  emailVerified: boolean;
  image: string | null;
  createdAt: Date;
  updatedAt: Date;
  isAnonymous: boolean | null;
  role: string | null;
  banned: boolean | null;
  banReason: string | null;
  banExpires: Date | null;
  status: string;
  claimedAt: Date | null;
  mergedIntoUserId: string | null;
}

export interface BotIngressUserBindingRow {
  id: string;
  userId: string;
  platform: string;
  externalUserId: string;
  externalUserName: string | null;
  namespace: string | null;
  source: string;
  assurance: string;
  establishedByGrantId: string | null;
  status: string;
  supersededByBindingId: string | null;
  revokedReason: string | null;
  metadata: unknown;
  createdAt: Date;
  updatedAt: Date;
  endedAt: Date | null;
}

export interface CreateBotIngressUserInput {
  id?: string;
  name: string;
  email: string;
  emailVerified: boolean;
  image?: string | null;
  createdAt: Date;
  updatedAt: Date;
  isAnonymous?: boolean | null;
  role?: string | null;
  banned?: boolean | null;
  banReason?: string | null;
  banExpires?: Date;
  status?: string;
  claimedAt?: Date;
  mergedIntoUserId?: string | null;
}

export interface CreateBotIngressUserBindingInput {
  id?: string;
  userId: string;
  platform: string;
  externalUserId: string;
  externalUserName?: string | null;
  namespace?: string | null;
  source: string;
  assurance: string;
  establishedByGrantId?: string | null;
  status?: string;
  supersededByBindingId?: string | null;
  revokedReason?: string | null;
  metadata?: unknown;
}

export interface CreateBotIngressChannelInput {
  id?: string;
  type: string;
  name?: string | null;
  status?: string;
  metadata?: unknown;
  createdByUserId?: string | null;
}

export interface CreateBotIngressChannelBindingInput {
  id?: string;
  channelId: string;
  platform: string;
  externalChannelId: string;
  externalChannelName?: string | null;
  namespace?: string | null;
  botPluginInstanceId?: string | null;
  source: string;
  assurance: string;
  establishedByGrantId?: string | null;
  status?: string;
  supersededByBindingId?: string | null;
  revokedReason?: string | null;
  suspendedReason?: string | null;
  metadata?: unknown;
  endedAt?: Date | null;
}

export interface CreateBotIngressClaimSessionInput {
  id: string;
  initiatedFrom: string;
  purpose: string;
  subjectType: string;
  subjectId?: string | null;
  anonymousUserId?: string | null;
  anonymousUserName?: string | null;
  observedUserPlatform?: string | null;
  observedUserId?: string | null;
  observedUserName?: string | null;
  observedUserNamespace?: string | null;
  observedChannelPlatform?: string | null;
  observedChannelId?: string | null;
  observedChannelName?: string | null;
  observedChannelNamespace?: string | null;
  grantId?: string | null;
  status: string;
  resolvedUserId?: string | null;
  resolvedChannelId?: string | null;
  resolution?: string | null;
  metadata?: unknown;
  resolvedAt?: Date | null;
}

export interface CreateBotIngressSubscriptionInput {
  id: string;
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

export interface IBotIngressRepository {
  listNamedActiveMockBotInstances(): Promise<BotIngressBotPluginInstanceRow[]>;
  findActiveUserBindingIdentity(input: {
    platform: string;
    externalUserId: string;
    namespace: string;
  }): Promise<BotIngressUserBindingRow | null>;
  findActiveChannelBindingIdentity(input: {
    platform: string;
    externalChannelId: string;
    namespace: string;
  }): Promise<BotIngressChannelBindingRow | null>;
  findChannelById(channelId: string): Promise<BotIngressChannelRow | null>;
  findUserById(userId: string): Promise<BotIngressUserRow | null>;
  createAnonymousUser(input: CreateBotIngressUserInput): Promise<BotIngressUserRow>;
  createUserBinding(input: CreateBotIngressUserBindingInput): Promise<BotIngressUserBindingRow>;
  updateUserBindingName(id: string, externalUserName: string): Promise<BotIngressUserBindingRow>;
  updateAnonymousUserName(id: string, name: string): Promise<BotIngressUserRow>;
  createChannel(input: CreateBotIngressChannelInput): Promise<BotIngressChannelRow>;
  createChannelBinding(
    input: CreateBotIngressChannelBindingInput,
  ): Promise<BotIngressChannelBindingRow>;
  updateChannelBindingContext(input: {
    id: string;
    externalChannelName: string;
    botPluginInstanceId?: string | null;
  }): Promise<BotIngressChannelBindingRow>;
  updateChannelName(id: string, name: string): Promise<void>;
  listPendingClaimSessionsForContext(input: {
    anonymousUserId: string;
    platform: string;
    observedUserId: string;
    namespace: string;
  }): Promise<BotIngressClaimSessionRow[]>;
  cancelClaimSessionsAndGrants(input: { sessionIds: string[]; grantIds: string[] }): Promise<void>;
  createClaimSession(input: CreateBotIngressClaimSessionInput): Promise<BotIngressClaimSessionRow>;
  resolveActiveConnectionForUser(input: {
    userId: string;
    provider?: string;
  }): Promise<BotIngressConnectionRow | null>;
  findPendingClaimSessionForContext(input: {
    anonymousUserId: string;
    platform: string;
    observedUserId: string;
    namespace: string;
  }): Promise<BotIngressClaimSessionRow | null>;
  findPendingBindingGrantByTokenHash(tokenHash: string): Promise<BotIngressBindingGrantRow | null>;
  markBindingGrantConsumed(grantId: string, now?: Date): Promise<void>;
  supersedeUserBinding(id: string, now?: Date): Promise<void>;
  createConfirmedUserBinding(
    input: CreateBotIngressUserBindingInput,
  ): Promise<BotIngressUserBindingRow>;
  markAnonymousUserMerged(input: {
    anonymousUserId: string;
    targetUserId: string;
    now?: Date;
  }): Promise<void>;
  markUserBindingSupersededBy(input: { id: string; supersededByBindingId: string }): Promise<void>;
  supersedeChannelBinding(id: string, now?: Date): Promise<void>;
  createConfirmedChannelBinding(
    input: CreateBotIngressChannelBindingInput,
  ): Promise<BotIngressChannelBindingRow>;
  markChannelBindingSupersededBy(input: {
    id: string;
    supersededByBindingId: string;
  }): Promise<void>;
  findActiveConnectionForOwnerProvider(input: {
    ownerUserId: string;
    provider: string;
  }): Promise<BotIngressConnectionRow | null>;
  markOnlyDefaultConnection(input: {
    ownerUserId: string;
    provider: string;
    connectionId: string;
  }): Promise<void>;
  findMatchingSubscription(
    target: ResolvedSubscriptionTarget,
  ): Promise<BotIngressSubscriptionRow | null>;
  createSubscription(input: CreateBotIngressSubscriptionInput): Promise<BotIngressSubscriptionRow>;
  updateSubscriptionStatus(id: string, status: string): Promise<BotIngressSubscriptionRow>;
  listActiveSubscriptionsByChannelId(channelId: string): Promise<BotIngressSubscriptionRow[]>;
}
