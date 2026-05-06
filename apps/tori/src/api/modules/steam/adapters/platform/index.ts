import type {
  ConnectionAccountProfileResult,
  ConnectionFamilyRefreshResult,
  IntegrationProviderHandlers,
} from "@/api/modules/platform/integration/provider-registry.ts";
import type { AnyBotCommandDefinition } from "@/api/modules/platform/bot-ingress/registry.ts";
import type { SubscriptionTargetDefinition } from "@/api/modules/platform/bot-ingress/commands/subscription-targets.ts";
import { getSteamConnectionAccountProfile } from "../../core/account/service.js";
import { steamAccountCommandDefinitions } from "./bot-ingress/account.js";
import { refreshSteamFamily } from "../../core/family/service.js";
import { steamFamilySubscriptionTargetDefinitions } from "./bot-ingress/family.js";

export const steamBotCommandDefinitions =
  steamAccountCommandDefinitions as readonly AnyBotCommandDefinition[];

export const steamSubscriptionTargetDefinitions =
  steamFamilySubscriptionTargetDefinitions as readonly SubscriptionTargetDefinition[];

export const steamIntegrationProviderHandlers: IntegrationProviderHandlers = {
  provider: "steam",
  async getConnectionAccountProfile(ctx, connectionId): Promise<ConnectionAccountProfileResult> {
    const result = await getSteamConnectionAccountProfile(ctx, connectionId);
    return {
      connectionId: result.connection.id,
      externalAccountId: result.accountProfile.steamId,
      displayName: result.accountProfile.personaName ?? null,
      avatarUrl: result.accountProfile.avatarUrl ?? null,
      profileUrl: result.accountProfile.profileUrl ?? null,
      lastSyncedAt: result.accountProfile.lastSyncedAt?.toISOString() ?? null,
      fetchedFromNetwork: result.fetchedFromNetwork,
    };
  },
  async refreshConnectionFamily(ctx, connectionId): Promise<ConnectionFamilyRefreshResult> {
    const result = await refreshSteamFamily(ctx, {
      connectionId,
      ownerUserId: ctx.userId ?? undefined,
      triggerType: "manual",
    });
    return {
      connectionId: result.connection.id,
      familyId: result.family.id,
      librarySize: result.librarySize,
      syncedAt: result.syncedAt.toISOString(),
      addedCount: result.addedGames.length,
      removedCount: result.removedGames.length,
    };
  },
};
