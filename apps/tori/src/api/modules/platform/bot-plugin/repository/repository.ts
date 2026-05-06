/* oxlint-disable typescript-eslint/no-redundant-type-constituents */

export type BotPluginRepositoryJson = unknown;

export interface ManagedBotPluginInstance {
  id: string;
  ownerUserId: string;
  platform: string;
  namespace: string | null;
  instanceKey: string;
  displayName: string | null;
  callbackMode: string;
  deliveryEndpointId: string | null;
  status: string;
  capabilities: BotPluginRepositoryJson | null;
  metadata: BotPluginRepositoryJson | null;
  lastSeenAt: Date | null;
  createdAt: Date;
  updatedAt: Date;
}

export interface ManagedDeliveryEndpoint {
  id: string;
  ownerUserId: string | null;
  platform: string;
  kind: string;
  displayName: string | null;
  target: string;
  secret: string | null;
  status: string;
  config: BotPluginRepositoryJson | null;
  metadata: BotPluginRepositoryJson | null;
  lastUsedAt: Date | null;
  createdAt: Date;
  updatedAt: Date;
}

export interface CreateInternalDeliveryEndpointInput {
  id: string;
  ownerUserId?: string | null;
  platform: string;
  kind: string;
  target: string;
  displayName?: string | null;
  secret?: string | null;
  status?: string;
  config?: BotPluginRepositoryJson | null;
  metadata?: BotPluginRepositoryJson | null;
  lastUsedAt?: Date | null;
}

export interface CreateManagedBotInstanceInput {
  id: string;
  ownerUserId: string;
  platform: string;
  namespace?: string | null;
  instanceKey: string;
  displayName?: string | null;
  callbackMode?: string;
  deliveryEndpointId?: string | null;
  status?: string;
  capabilities?: BotPluginRepositoryJson | null;
  metadata?: BotPluginRepositoryJson | null;
  lastSeenAt?: Date | null;
}

export interface IBotPluginRepository {
  listManagedBotInstances(ownerUserId: string): Promise<ManagedBotPluginInstance[]>;
  findActiveMockBotInstance(): Promise<ManagedBotPluginInstance | null>;
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
    displayName?: string | null;
    capabilities?: BotPluginRepositoryJson | null;
    credentialHash: string;
  }): Promise<ManagedBotPluginInstance>;
  createManagedBotInstance(input: CreateManagedBotInstanceInput): Promise<ManagedBotPluginInstance>;
  updateManagedBotInstance(input: {
    id: string;
    displayName?: string | null;
    capabilities?: BotPluginRepositoryJson | null;
    status?: string | null;
  }): Promise<ManagedBotPluginInstance | null>;
  findManagedBotInstanceById(id: string): Promise<ManagedBotPluginInstance | null>;
  rotateManagedBotInstanceCredential(input: { id: string; credentialHash: string }): Promise<void>;
  findActiveManagedBotInstanceByCredentialHash(
    credentialHash: string,
  ): Promise<ManagedBotPluginInstance | null>;
  markManagedBotInstanceSeen(id: string): Promise<ManagedBotPluginInstance>;
  revokeManagedBotInstance(id: string): Promise<ManagedBotPluginInstance>;
  attachManagedBotInstanceEndpoint(input: {
    id: string;
    deliveryEndpointId?: string | null;
  }): Promise<ManagedBotPluginInstance | null>;
}
