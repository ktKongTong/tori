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
