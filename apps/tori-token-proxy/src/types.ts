// Shared types used across the application

export interface Connection {
  id: string;
  provider: string;
  providerUid: string;
  displayName: string;
  label?: string | null;
  tokenInject: string;
  apiKey: string;
  permissions?: string[];
  status: string;
  createdAt: number;
  updatedAt?: number | null;
  lastUsedAt?: number | null;
}

export interface SystemTaskDefinition {
  id: string;
  kind: string;
  provider: string;
  enabled: boolean;
  intervalSec: number;
  payload: Record<string, unknown>;
  nextRunAt: number;
  lastTriggeredAt?: number | null;
  lastRunAt?: number | null;
  lastRunStatus?: string | null;
  lastError?: string | null;
  createdAt: number;
  updatedAt: number;
}

export interface SystemTaskRun {
  id: string;
  taskDefinitionId: string;
  kind: string;
  status: string;
  summary?: Record<string, unknown> | null;
  errorMessage?: string | null;
  scheduledFor?: number | null;
  startedAt?: number | null;
  finishedAt?: number | null;
  createdAt: number;
}

export interface TokenRefreshLog {
  id: number;
  taskRunId?: string | null;
  connectionId: string;
  provider: string;
  status: string;
  message?: string | null;
  createdAt: number;
}

export interface EncryptedCredentials {
  accessToken: string; // encrypted
  refreshToken: string; // encrypted
}

export interface AuthSessionState {
  providerName: string;
  flowType: "poll" | "redirect" | "direct";
  challengeData: Record<string, unknown>;
  expiresAt: number;
  mode?: "connect" | "reconnect" | "external-connect";
  reconnectConnectionId?: string | null;
  externalConnect?: {
    state: string;
    callbackUrl: string;
    connectionId?: string | null;
  } | null;
  requestedConnection?: {
    label?: string | null;
    permissions?: string[];
  } | null;
  result?: AuthResult | null;
  authCode?: string | null;
  error?: string | null;
}

export interface AuthResult {
  providerUid: string;
  displayName: string;
  accessToken: string;
  refreshToken: string;
}

export interface ProxyRule {
  id: number;
  provider: string;
  allowedHost: string;
  pathPattern: string;
  methods: string;
}

export interface CreateConnectionParams {
  provider: string;
  providerUid: string;
  displayName: string;
  label?: string | null;
  tokenInject: string;
  permissions?: string[];
  credentials: EncryptedCredentials;
}

export interface RequestLog {
  id: number;
  connectionId: string;
  routeGroup: string;
  method: string;
  targetUrl?: string | null;
  statusCode?: number | null;
  error?: string | null;
  createdAt: number;
}
