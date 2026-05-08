import { ParameterError } from "@/api/domain/error/index.ts";
import type { ServiceContext } from "@/api/domain/infra/service-context.ts";
import { resolveConnectionAccess } from "@/api/modules/platform/integration/command.ts";

export type ConnectionAccountProfileResult = {
  connectionId: string;
  externalAccountId: string;
  displayName: string | null;
  avatarUrl: string | null;
  profileUrl: string | null;
  lastSyncedAt: string | null;
  fetchedFromNetwork: boolean;
};

export type ConnectionFamilyRefreshResult = {
  connectionId: string;
  familyId: string;
  librarySize: number;
  syncedAt: string;
  addedCount: number;
  removedCount: number;
};

export type IntegrationProviderHandlers = {
  provider: string;
  getConnectionAccountProfile?: (
    ctx: ServiceContext,
    connectionId: string,
  ) => Promise<ConnectionAccountProfileResult>;
  refreshConnectionFamily?: (
    ctx: ServiceContext,
    connectionId: string,
  ) => Promise<ConnectionFamilyRefreshResult>;
};

const providerHandlers = new Map<string, IntegrationProviderHandlers>();

export function registerIntegrationProviderHandlers(...definitions: IntegrationProviderHandlers[]) {
  for (const definition of definitions) {
    const key = definition.provider.trim().toLowerCase();
    if (providerHandlers.has(key)) {
      throw new Error(`Integration provider handlers already registered: ${key}`);
    }
    providerHandlers.set(key, definition);
  }
}

function getIntegrationProviderHandlers(provider: string) {
  return providerHandlers.get(provider.trim().toLowerCase()) ?? null;
}

export async function getConnectionAccountProfile(ctx: ServiceContext, connectionId: string) {
  const result = await resolveConnectionAccess(ctx, connectionId);
  const handlers = getIntegrationProviderHandlers(result.connection.provider);
  if (!handlers?.getConnectionAccountProfile) {
    throw new ParameterError(
      `Provider ${result.connection.provider} does not support account profile fetch`,
    );
  }

  return handlers.getConnectionAccountProfile(ctx, connectionId);
}

export async function refreshConnectionFamily(ctx: ServiceContext, connectionId: string) {
  const result = await resolveConnectionAccess(ctx, connectionId);
  const handlers = getIntegrationProviderHandlers(result.connection.provider);
  if (!handlers?.refreshConnectionFamily) {
    throw new ParameterError(
      `Provider ${result.connection.provider} does not support family refresh`,
    );
  }

  return handlers.refreshConnectionFamily(ctx, connectionId);
}
