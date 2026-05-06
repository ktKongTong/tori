import { z } from "zod";

import { defineBotCommand } from "../registry.js";
import { getBotIngressRepository } from "../repository/index.js";
import { parseCommandOptions } from "./helpers.js";
import { getSubscriptionTarget } from "./subscription-targets.js";

const unsubCommandStateSchema = z.discriminatedUnion("kind", [
  z.object({
    kind: z.literal("invalid-target"),
    provider: z.string(),
    resource: z.string(),
  }),
  z.object({
    kind: z.literal("invalid-owner"),
    owner: z.string(),
  }),
  z.object({
    kind: z.literal("invalid-event"),
    event: z.string(),
  }),
  z.object({
    kind: z.literal("unavailable"),
    provider: z.string(),
  }),
  z.object({
    kind: z.literal("requires-token-connection"),
    provider: z.string(),
    resource: z.string(),
  }),
  z.object({
    kind: z.literal("not-found"),
    provider: z.string(),
    resource: z.string(),
    ownerType: z.enum(["USER", "CHANNEL"]),
    eventTypes: z.array(z.string()),
  }),
  z.object({
    kind: z.literal("disabled"),
    operation: z.enum(["disabled", "already-disabled"]),
    provider: z.string(),
    resource: z.string(),
    ownerType: z.enum(["USER", "CHANNEL"]),
    eventTypes: z.array(z.string()),
    subscriptionId: z.string(),
    connectionId: z.string(),
  }),
]);

export const unsubCommand = defineBotCommand({
  name: "unsub",
  action: "subscription-disabled",
  stateSchema: unsubCommandStateSchema,
  handler: async (ctx, input, context) => {
    const { args, options } = parseCommandOptions(input.commandParams);
    const provider = args[0]?.trim().toLowerCase() ?? "";
    const resource = args[1]?.trim().toLowerCase() ?? "";
    const targetDefinition = getSubscriptionTarget(provider, resource);
    if (!targetDefinition) {
      return {
        kind: "invalid-target" as const,
        provider,
        resource,
      };
    }

    const resolved = await targetDefinition.resolve(ctx, context, {
      args,
      options,
      messageContext: input.messageContext,
    });
    if (resolved.kind !== "applied") return resolved;

    const target = resolved.target;
    const existing = await getBotIngressRepository(ctx).findMatchingSubscription(target);

    if (!existing) {
      return {
        kind: "not-found" as const,
        provider: target.provider,
        resource: target.resource,
        ownerType: target.ownerType,
        eventTypes: target.eventTypes,
      };
    }

    if (existing.status === "disabled") {
      return {
        kind: "disabled" as const,
        operation: "already-disabled" as const,
        provider: target.provider,
        resource: target.resource,
        ownerType: target.ownerType,
        eventTypes: target.eventTypes,
        subscriptionId: existing.id,
        connectionId: target.connectionId,
      };
    }

    const disabled = await getBotIngressRepository(ctx).updateSubscriptionStatus(
      existing.id,
      "disabled",
    );

    return {
      kind: "disabled" as const,
      operation: "disabled" as const,
      provider: target.provider,
      resource: target.resource,
      ownerType: target.ownerType,
      eventTypes: target.eventTypes,
      subscriptionId: disabled.id,
      connectionId: target.connectionId,
    };
  },
});
