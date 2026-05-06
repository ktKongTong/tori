import { z } from "zod";
import {
  findPendingClaimSessionForContext,
  resolveActiveConnectionForContext,
} from "../context.js";
import { defineBotCommand } from "../registry.js";
import { getBotIngressRepository } from "../repository/index.js";

const statusStateSchema = z.object({
  identity: z.enum(["anonymous", "claimed"]),
  userBindingId: z.string(),
  channelBindingId: z.string(),
  connection: z
    .object({
      id: z.string(),
      provider: z.string(),
      accessMode: z.string(),
    })
    .nullable(),
  pendingClaimSessionId: z.string().nullable(),
  activeSubscriptionCount: z.number().int(),
});

export const statusCommand = defineBotCommand({
  name: "status",
  action: "status",
  stateSchema: statusStateSchema,
  handler: async (ctx, input, context) => {
    const [connection, pendingClaim, activeSubscriptions] = await Promise.all([
      resolveActiveConnectionForContext(ctx, context),
      findPendingClaimSessionForContext(ctx, input.messageContext, context),
      getBotIngressRepository(ctx).listActiveSubscriptionsByChannelId(
        context.channelBinding.channelId,
      ),
    ]);
    const identity: "anonymous" | "claimed" = context.anonymousUser ? "anonymous" : "claimed";

    return {
      identity,
      userBindingId: context.userBinding.id,
      channelBindingId: context.channelBinding.id,
      connection: connection
        ? {
            id: connection.id,
            provider: connection.provider,
            accessMode: connection.accessMode,
          }
        : null,
      pendingClaimSessionId: pendingClaim?.id ?? null,
      activeSubscriptionCount: activeSubscriptions.length,
    };
  },
});
