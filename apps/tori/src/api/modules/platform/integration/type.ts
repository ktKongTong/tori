export interface RegisterProxyInstanceInput {
  baseUrl: string;
  credentialRef: string;
  name?: string | null;
  metadata?: Record<string, unknown> | null;
}

export interface CreateConnectionInput {
  provider: string;
  providerAccountId: string;
  providerAccountName?: string | null;
  providerAccountAvatar?: string | null;
  accessMode: "public-id" | "proxy-token" | "mixed";
  proxyInstanceId?: string | null;
  isDefault?: boolean;
  metadata?: Record<string, unknown> | null;
}

export interface ProbeProxyInstanceResult {
  healthStatus: "healthy" | "unreachable" | "degraded";
  providers: Array<{
    name: string;
    flow: string;
    grantType: string;
  }>;
  capabilities: Record<string, unknown>;
}
