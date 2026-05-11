import type { ProxyInstance } from "@/api/modules/platform/connection/repository/repository.ts";
export type { ProxyInstance };
import type {
  PageBasedPaginationParam,
  PageBasedPaginationResult,
} from "@repo/utils/schema/paging";

export interface CreateProxyInstanceInput {
  id: string;
  ownerUserId: string;
  provider: string;
  baseUrl: string;
  credentialRef: string;
  name?: string | null;
  status?: string;
  healthStatus?: string;
  capabilities?: unknown;
  metadata?: unknown;
  lastSeenAt?: Date | null;
}

export interface UpdateProxyInstanceRegistrationInput {
  id: string;
  credentialRef: string;
  name?: string | null;
  healthStatus: string;
  capabilities: unknown;
  metadata?: unknown;
}

export interface UpdateProxyInstanceProbeInput {
  id: string;
  healthStatus: string;
  capabilities: unknown;
}

export interface UpdateProxyInstanceStatusInput {
  id: string;
  ownerUserId: string;
  status: string;
}

export interface IIntegrationRepository {
  listProxyInstances(
    page: PageBasedPaginationParam,
  ): Promise<PageBasedPaginationResult<ProxyInstance>>;
  findProxyInstanceByOwnerAndBaseUrl(input: {
    ownerUserId: string;
    baseUrl: string;
  }): Promise<ProxyInstance | null>;
  updateProxyInstanceRegistration(
    input: UpdateProxyInstanceRegistrationInput,
  ): Promise<ProxyInstance>;
  createProxyInstance(input: CreateProxyInstanceInput): Promise<ProxyInstance>;
  findProxyInstanceForOwner(input: {
    id: string;
    ownerUserId: string;
  }): Promise<ProxyInstance | null>;
  updateProxyInstanceProbe(input: UpdateProxyInstanceProbeInput): Promise<ProxyInstance>;
  updateProxyInstanceStatus(input: UpdateProxyInstanceStatusInput): Promise<ProxyInstance | null>;
  deleteProxyInstance(input: { id: string; ownerUserId: string }): Promise<ProxyInstance | null>;
}
