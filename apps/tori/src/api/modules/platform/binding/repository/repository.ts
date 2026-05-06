/* oxlint-disable typescript-eslint/no-redundant-type-constituents */

export type BindingRepositoryJson = unknown;

export interface BindingGrantRow {
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
  metadata: BindingRepositoryJson | null;
  createdAt: Date;
  updatedAt: Date;
}

export interface ClaimSessionRow {
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
  metadata: BindingRepositoryJson | null;
  createdAt: Date;
  updatedAt: Date;
  resolvedAt: Date | null;
}

export interface UserRow {
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

export interface UserBindingRow {
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
  metadata: BindingRepositoryJson | null;
  createdAt: Date;
  updatedAt: Date;
  endedAt: Date | null;
}

export interface CreateBindingGrantInput {
  id: string;
  code: string;
  tokenHash: string;
  purpose: string;
  subjectType: string;
  subjectId: string;
  issuedByUserId?: string | null;
  issuedFrom: string;
  issuedToSurface: string;
  status?: string;
  codeExpiresAt: Date;
  tokenExpiresAt: Date;
  consumedAt?: Date | null;
  maxUses?: number;
  usedCount?: number;
  metadata?: BindingRepositoryJson | null;
}

export interface IBindingRepository {
  createBindingGrant(input: CreateBindingGrantInput): Promise<BindingGrantRow>;
  findPendingBindingGrantByTokenHash(tokenHash: string): Promise<BindingGrantRow | null>;
  findClaimSessionByGrantId(grantId: string): Promise<ClaimSessionRow | null>;
  findUserById(userId: string): Promise<UserRow | null>;
  resolveAnonymousClaim(input: {
    grantId: string;
    claimSessionId: string;
    anonymousUserId: string;
    authenticatedUserId: string;
    resolution: string;
  }): Promise<ClaimSessionRow>;
  findUserBindingById(bindingId: string): Promise<UserBindingRow | null>;
  revokeUserBinding(bindingId: string): Promise<UserBindingRow>;
}
