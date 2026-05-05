import type { AuthResult, AuthSessionState } from "../types.ts";

// ─── Flow Types ───

export type FlowType = "poll" | "redirect" | "direct";

// ─── Poll Result ───

export interface PollResult {
  /** Non-null when auth is complete */
  result?: AuthResult;
  /** Updated challenge data (e.g. new QR URL) */
  updatedChallenge?: Record<string, unknown>;
  /** Non-null when auth failed (user denied, session expired, etc.) */
  error?: string;
}

// ─── Provider Interface ───

export interface Provider {
  name: string;
  displayName?: string;
  flow: FlowType;
  refreshPolicy?: {
    intervalSec: number;
  };

  /** Start an auth flow. Returns challenge data (QR URL, redirect URL, etc.) */
  beginAuth(params: Record<string, unknown>): Promise<{
    challengeData: Record<string, unknown>;
  }>;

  /** Check auth status. Only for 'poll' flow. */
  pollAuth(session: AuthSessionState): Promise<PollResult>;

  /** Handle OAuth callback. Only for 'redirect' flow. */
  callbackAuth(
    session: AuthSessionState,
    callbackParams: Record<string, string>,
  ): Promise<AuthResult>;

  /** Refresh an expired token. */
  refreshToken(refreshToken: string): Promise<{ accessToken: string; refreshToken?: string }>;

  /** Default token injection method (bearer, header:X-Token, query:token) */
  tokenInjectMethod: string;
}
