import { z } from "zod";
import { createOutboxEventFromCtx } from "@/api/domain/infra";
import {
  SUBSCRIPTION_ACTIVATED,
  SUBSCRIPTION_CREATED,
} from "@/api/modules/platform/notify/type.ts";
import { uniqueId } from "@repo/utils/id";

import { defineBotCommand } from "../registry.js";
import { getBotIngressRepository } from "../repository/index.js";
import { parseCommandOptions } from "./helpers.js";
import { findMatchingSubscription, getSubscriptionTarget } from "./subscription-targets.js";

const subCommandStateSchema = z.discriminatedUnion("kind", [
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
    kind: z.literal("applied"),
    operation: z.enum(["created", "reactivated", "already-active"]),
    provider: z.string(),
    resource: z.string(),
    ownerType: z.enum(["USER", "CHANNEL"]),
    eventTypes: z.array(z.string()),
    topicType: z.string(),
    subscriptionId: z.string(),
    connectionId: z.string(),
  }),
]);

export const subCommand = defineBotCommand({
  name: "sub",
  action: "subscription-applied",
  stateSchema: subCommandStateSchema,
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
    const existing = await findMatchingSubscription(ctx, target);

    if (existing?.status === "active") {
      return {
        kind: "applied" as const,
        operation: "already-active" as const,
        provider: target.provider,
        resource: target.resource,
        ownerType: target.ownerType,
        eventTypes: target.eventTypes,
        topicType: target.topicType,
        subscriptionId: existing.id,
        connectionId: target.connectionId,
      };
    }

    if (existing) {
      const reactivated = await getBotIngressRepository(ctx).updateSubscriptionStatus(
        existing.id,
        "active",
      );
      await ctx.sendEvent(
        createOutboxEventFromCtx(ctx, {
          type: SUBSCRIPTION_ACTIVATED,
          subject: `subscription:${reactivated.id}`,
          payload: {
            subscriptionId: reactivated.id,
            channelId: reactivated.channelId,
            botPluginInstanceId: reactivated.botPluginInstanceId ?? null,
            connectionId: reactivated.connectionId,
            ownerType: reactivated.ownerType,
            ownerId: reactivated.ownerId,
            topicType: reactivated.topicType,
            topicKey: reactivated.topicKey,
            eventTypes: reactivated.eventTypes,
          },
        }),
      );

      return {
        kind: "applied" as const,
        operation: "reactivated" as const,
        provider: target.provider,
        resource: target.resource,
        ownerType: target.ownerType,
        eventTypes: target.eventTypes,
        topicType: target.topicType,
        subscriptionId: reactivated.id,
        connectionId: target.connectionId,
      };
    }

    const created = await getBotIngressRepository(ctx).createSubscription({
      id: uniqueId(),
      channelId: target.channelId,
      botPluginInstanceId: target.botPluginInstanceId,
      connectionId: target.connectionId,
      ownerType: target.ownerType,
      ownerId: target.ownerId,
      topicType: target.topicType,
      topicKey: target.topicKey,
      eventTypes: target.eventTypes,
      createdByUserId: ctx.userId ?? null,
    });

    await ctx.sendEvent(
      createOutboxEventFromCtx(ctx, {
        type: SUBSCRIPTION_CREATED,
        subject: `subscription:${created.id}`,
        payload: {
          subscriptionId: created.id,
          channelId: created.channelId,
          botPluginInstanceId: created.botPluginInstanceId ?? null,
          connectionId: created.connectionId,
          ownerType: created.ownerType,
          ownerId: created.ownerId,
          topicType: created.topicType,
          topicKey: created.topicKey,
          eventTypes: created.eventTypes,
        },
      }),
    );

    return {
      kind: "applied" as const,
      operation: "created" as const,
      provider: target.provider,
      resource: target.resource,
      ownerType: target.ownerType,
      eventTypes: target.eventTypes,
      topicType: target.topicType,
      subscriptionId: created.id,
      connectionId: target.connectionId,
    };
  },
});
