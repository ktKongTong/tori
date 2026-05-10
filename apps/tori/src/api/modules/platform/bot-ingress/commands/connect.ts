import { z } from "zod";
import { createConnection } from "@/api/modules/platform/connection/command.ts";

import { defineBotCommand } from "../registry.js";
import { getBotIngressRepository } from "../repository/index.js";

const connectCommandStateSchema = z.discriminatedUnion("kind", [
  z.object({
    kind: z.literal("invalid-provider"),
    provider: z.string(),
  }),
  z.object({
    kind: z.literal("invalid-mode"),
    provider: z.string(),
    mode: z.string(),
  }),
  z.object({
    kind: z.literal("invalid-identifier"),
    provider: z.string(),
    identifier: z.string(),
  }),
  z.object({
    kind: z.literal("connected"),
    provider: z.string(),
    connectionId: z.string(),
    providerAccountId: z.string(),
    accessMode: z.literal("public-id"),
    created: z.boolean(),
  }),
]);

const STEAM_ID_OR_VANITY_PATTERN = /^(\d{17}|[A-Za-z0-9_-]{2,64})$/;

export const connectCommand = defineBotCommand({
  name: "connect",
  action: "connection-connected",
  stateSchema: connectCommandStateSchema,
  handler: async (ctx, input) => {
    const provider = input.commandParams[0]?.trim().toLowerCase() ?? "";
    if (provider !== "steam") {
      return {
        kind: "invalid-provider" as const,
        provider,
      };
    }

    const mode = input.commandParams[1]?.trim().toLowerCase() ?? "";
    if (mode !== "id") {
      return {
        kind: "invalid-mode" as const,
        provider,
        mode,
      };
    }

    const identifier = input.commandParams.slice(2).join(" ").trim();
    if (!identifier || !STEAM_ID_OR_VANITY_PATTERN.test(identifier)) {
      return {
        kind: "invalid-identifier" as const,
        provider,
        identifier,
      };
    }

    const botIngressRepository = getBotIngressRepository(ctx);
    const activeSteamConnection = await botIngressRepository.findActiveConnectionForOwnerProvider({
      ownerUserId: ctx.userId ?? "",
      provider: "steam",
    });

    const result = await createConnection(ctx, {
      provider: "steam",
      providerAccountId: identifier,
      accessMode: "public-id",
      isDefault: !activeSteamConnection,
      metadata: {
        source: "chat-connect",
        mode: "public-id",
      },
    });

    await botIngressRepository.markOnlyDefaultConnection({
      ownerUserId: result.ownerUserId,
      provider: "steam",
      connectionId: result.id,
    });

    return {
      kind: "connected" as const,
      provider: "steam",
      connectionId: result.id,
      providerAccountId: result.providerAccountId,
      accessMode: "public-id" as const,
      created: true,
    };
  },
});
