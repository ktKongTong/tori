export interface RegisterProxyInstanceInput {
  baseUrl: string;
  clientId: string;
  clientSecret: string;
  name?: string | null;
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
