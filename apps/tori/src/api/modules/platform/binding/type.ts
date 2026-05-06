export type BindingGrantPurpose = "claim-user" | "bind-user" | "bind-channel";
export type BindingGrantSubjectType = "user" | "channel";
export type BindingGrantSurface = "bot" | "web";

export interface IssueBindingTokenInput {
  purpose: BindingGrantPurpose;
  subjectType: BindingGrantSubjectType;
  subjectId: string;
  issuedToSurface: BindingGrantSurface;
  codeExpiresAt?: string;
  tokenExpiresAt?: string;
  maxUses?: number;
  metadata?: Record<string, unknown> | null;
}

export interface ConsumeAnonymousClaimInput {
  token: string;
}

export interface ConsumeBindingGrantInput {
  consumeSurface: BindingGrantSurface;
  allowedSubjectTypes?: BindingGrantSubjectType[];
}
