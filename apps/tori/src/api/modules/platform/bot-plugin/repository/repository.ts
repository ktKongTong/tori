import type {
  PageBasedPaginationParam,
  PageBasedPaginationResult,
} from "@repo/utils/schema/paging";

export type BotPluginRepositoryJson = unknown;

export interface ManagedBotPluginInstance {
  id: string;
  ownerUserId: string;
  platform: string;
  namespace: string | null;
  instanceKey: string;
  name: string | null;
  callbackMode: string;
  deliveryEndpointId: string | null;
  status: string;
  capabilities: unknown;
  metadata: unknown;
  lastSeenAt: Date | null;
  deletedAt: Date | null;
  createdAt: Date;
  updatedAt: Date;
}

export interface ManagedDeliveryEndpoint {
  id: string;
  ownerUserId: string | null;
  platform: string;
  kind: string;
  name: string | null;
  target: string;
  secret: string | null;
  status: string;
  config: unknown;
  metadata: unknown;
  lastUsedAt: Date | null;
  deletedAt: Date | null;
  createdAt: Date;
  updatedAt: Date;
}

export interface CreateInternalDeliveryEndpointInput {
  id?: string;
  ownerUserId?: string | null;
  platform: string;
  kind: string;
  target: string;
  name?: string | null;
  secret?: string | null;
  status?: string;
  config?: unknown;
  metadata?: unknown;
}

export interface CreateManagedBotInstanceInput {
  id: string;
  ownerUserId: string;
  platform: string;
  namespace?: string | null;
  instanceKey: string;
  name: string;
  callbackMode?: string;
  deliveryEndpointId?: string | null;
  status?: string;
  capabilities?: unknown;
  metadata?: unknown;
  lastSeenAt?: Date | null;
}

export interface IBotPluginRepository {
  listManagedBotInstances(
    ownerUserId: string,
    page: PageBasedPaginationParam,
  ): Promise<PageBasedPaginationResult<ManagedBotPluginInstance>>;
  listVisibleManagedBotInstances(
    input: { ownerUserId: string; includeAll?: boolean },
    page: PageBasedPaginationParam,
  ): Promise<PageBasedPaginationResult<ManagedBotPluginInstance>>;
  findActivePlaygroundBotInstance(): Promise<ManagedBotPluginInstance | null>;
  findManagedBotInstanceIdentity(input: {
    ownerUserId: string;
    platform: string;
    namespace: string;
    instanceKey: string;
  }): Promise<ManagedBotPluginInstance | null>;
  createInternalDeliveryEndpoint(
    input: CreateInternalDeliveryEndpointInput,
  ): Promise<ManagedDeliveryEndpoint>;
  updateManagedBotInstanceRegistration(input: {
    id: string;
    name?: string | null;
    capabilities?: unknown;
    credentialHash: string;
  }): Promise<ManagedBotPluginInstance>;
  createManagedBotInstance(input: CreateManagedBotInstanceInput): Promise<ManagedBotPluginInstance>;
  updateManagedBotInstance(input: {
    id: string;
    name?: string | null;
    capabilities?: unknown;
    status?: "active" | "disabled" | null;
  }): Promise<ManagedBotPluginInstance | null>;
  findManagedBotInstanceById(id: string): Promise<ManagedBotPluginInstance | null>;
  rotateManagedBotInstanceCredential(input: { id: string; credentialHash: string }): Promise<void>;
  findActiveManagedBotInstanceByCredentialHash(
    credentialHash: string,
  ): Promise<ManagedBotPluginInstance | null>;
  markManagedBotInstanceSeen(id: string): Promise<ManagedBotPluginInstance>;
  revokeManagedBotInstance(id: string): Promise<ManagedBotPluginInstance>;
  deleteManagedBotInstance(id: string): Promise<ManagedBotPluginInstance | null>;
  deleteDeliveryEndpoint(id: string): Promise<ManagedDeliveryEndpoint | null>;
  attachManagedBotInstanceEndpoint(input: {
    id: string;
    deliveryEndpointId?: string | null;
  }): Promise<ManagedBotPluginInstance | null>;
}
