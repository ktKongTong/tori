import type { User } from "@/api/domain/infra";
import type {
  PageBasedPaginationParam,
  PageBasedPaginationResult,
} from "@repo/utils/schema/paging";

export interface UserBinding {
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
  deletedAt: Date | null;
  createdAt: Date;
  updatedAt: Date;
  endedAt: Date | null;
}

export interface ChannelBinding {
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
  deletedAt: Date | null;
  createdAt: Date;
  updatedAt: Date;
  endedAt: Date | null;
}

export interface BindingGrant {
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

export interface ClaimSession {
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

export interface CreateBindingGrantInput {
  id?: string;
  code: string;
  tokenHash: string;
  purpose: string;
  subjectType: string;
  subjectId: string;
  issuedByUserId?: string | null;
  issuedFrom: string;
  issuedToSurface: string;
  codeExpiresAt: Date;
  tokenExpiresAt: Date;
  maxUses?: number;
  metadata?: unknown;
}

export interface IBindingRepository {
  listUserBindings(page: PageBasedPaginationParam): Promise<PageBasedPaginationResult<UserBinding>>;
  listChannelBindings(
    page: PageBasedPaginationParam,
  ): Promise<PageBasedPaginationResult<ChannelBinding>>;
  listClaimSessions(
    page: PageBasedPaginationParam,
  ): Promise<PageBasedPaginationResult<ClaimSession>>;
  createBindingGrant(input: CreateBindingGrantInput): Promise<BindingGrant>;
  findPendingBindingGrantByTokenHash(tokenHash: string): Promise<BindingGrant | null>;
  findClaimSessionByGrantId(grantId: string): Promise<ClaimSession | null>;
  findUserById(userId: string): Promise<User | null>;
  resolveAnonymousClaim(input: {
    grantId: string;
    claimSessionId: string;
    anonymousUserId: string;
    authenticatedUserId: string;
    resolution: string;
  }): Promise<void>;
  findUserBindingById(bindingId: string): Promise<UserBinding | null>;
  revokeUserBinding(bindingId: string): Promise<UserBinding | null>;
  findChannelBindingById(bindingId: string): Promise<ChannelBinding | null>;
  revokeChannelBinding(bindingId: string): Promise<ChannelBinding | null>;
  suspendActiveChannelBindingsByBotPluginInstanceId(
    botPluginInstanceId: string,
    reason: string,
  ): Promise<number>;
  deleteChannelBindingsByBotPluginInstanceId(botPluginInstanceId: string): Promise<number>;
}
