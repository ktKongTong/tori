import { z } from "zod";
import { resolveActiveConnectionForContext } from "@/api/modules/platform/bot-ingress/context.ts";
import type { AnyBotCommandDefinition } from "@/api/modules/platform/bot-ingress/registry.ts";
import { defineBotCommand } from "@/api/modules/platform/bot-ingress/registry.ts";

import { fetchSteamPublicProfile, querySteamUserLibrary } from "../../../core/account/service.js";

const steamAccountProfileStateSchema = z.discriminatedUnion("hasConnection", [
  z.object({
    hasConnection: z.literal(false),
  }),
  z.object({
    hasConnection: z.literal(true),
    connectionId: z.string(),
    steamId: z.string(),
    personaName: z.string().nullable(),
    profileUrl: z.string().nullable(),
  }),
]);

const steamAccountInventoryStateSchema = z.discriminatedUnion("hasConnection", [
  z.object({
    hasConnection: z.literal(false),
  }),
  z.object({
    hasConnection: z.literal(true),
    connectionId: z.string(),
    totalCount: z.number().int(),
    matchedCount: z.number().int(),
    items: z.array(
      z.object({
        appId: z.number().int(),
        name: z.string().nullable(),
      }),
    ),
  }),
]);

export const steamAccountProfileCommand = defineBotCommand({
  name: "steam account profile",
  action: "steam-account-profile",
  stateSchema: steamAccountProfileStateSchema,
  handler: async (ctx, _input, context) => {
    const connection = await resolveActiveConnectionForContext(ctx, context, "steam");
    if (!connection) {
      return {
        hasConnection: false as const,
      };
    }

    const result = await fetchSteamPublicProfile(ctx, {
      connectionId: connection.id,
      ownerUserId: connection.ownerUserId,
    });

    return {
      hasConnection: true as const,
      connectionId: connection.id,
      steamId: result.accountProfile.steamId,
      personaName: result.accountProfile.personaName ?? null,
      profileUrl: result.accountProfile.profileUrl ?? null,
    };
  },
});

export const steamAccountInventoryCommand = defineBotCommand({
  name: "steam account inventory",
  action: "steam-account-inventory",
  stateSchema: steamAccountInventoryStateSchema,
  handler: async (ctx, _input, context) => {
    const connection = await resolveActiveConnectionForContext(ctx, context, "steam");
    if (!connection) {
      return {
        hasConnection: false as const,
      };
    }

    const result = await querySteamUserLibrary(ctx, {
      connectionId: connection.id,
      ownerUserId: connection.ownerUserId,
      limit: 10,
    });

    return {
      hasConnection: true as const,
      connectionId: connection.id,
      totalCount: result.totalCount,
      matchedCount: result.matchedCount,
      items: result.items.map((item) => ({
        appId: item.appId,
        name: item.name ?? null,
      })),
    };
  },
});

export const steamAccountCommandDefinitions = [
  steamAccountProfileCommand,
  steamAccountInventoryCommand,
] as const satisfies readonly AnyBotCommandDefinition[];
