import type { ProxyInstance } from "@/api/modules/platform/integration/connection/repository/repository.ts";
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
  status: "active" | "disabled";
}

export interface IIntegrationRepository {
  listProxyInstances(
    page: PageBasedPaginationParam,
  ): Promise<PageBasedPaginationResult<ProxyInstance>>;
  listVisibleProxyInstances(
    input: { ownerUserId: string; includeAll?: boolean },
    page: PageBasedPaginationParam,
  ): Promise<PageBasedPaginationResult<ProxyInstance>>;
  findProxyInstanceById(id: string): Promise<ProxyInstance | null>;
  findVisibleProxyInstance(input: {
    id: string;
    ownerUserId: string;
    includeAll?: boolean;
  }): Promise<ProxyInstance | null>;
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
