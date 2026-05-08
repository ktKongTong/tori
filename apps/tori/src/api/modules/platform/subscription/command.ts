import { NotFoundError, ParameterError } from "@/api/domain/error/index.ts";
import { createOutboxEventFromCtx } from "@/api/domain/infra";
import type { ServiceContext } from "@/api/domain/infra/service-context.ts";
import { uniqueId } from "@repo/utils/id";
import {
  type CreateSubscriptionInput,
  SUBSCRIPTION_ACTIVATED,
  SUBSCRIPTION_CREATED,
} from "./type.ts";

export async function createSubscription(ctx: ServiceContext, input: CreateSubscriptionInput) {
  const channelBinding = await ctx.repositories.subscription.findActiveChannelBindingByChannelId(
    input.channelId,
  );

  if (!channelBinding) {
    throw new NotFoundError("channel binding not found");
  }

  const botPluginInstanceId =
    input.botPluginInstanceId ?? channelBinding.botPluginInstanceId ?? null;
  if (!botPluginInstanceId) {
    throw new ParameterError("channel binding has no bot plugin instance");
  }

  const existing = await ctx.repositories.subscription.findSubscriptionIdentity({
    channelId: input.channelId,
    connectionId: input.connectionId,
    botPluginInstanceId,
    topicType: input.topicType,
    topicKey: input.topicKey,
  });

  if (existing) {
    return { subscription: existing, created: false };
  }

  const row = await ctx.repositories.subscription.createSubscription({
    id: uniqueId(),
    channelId: input.channelId,
    botPluginInstanceId,
    connectionId: input.connectionId,
    ownerType: input.ownerType,
    ownerId: input.ownerId ?? ctx.userId ?? input.channelId,
    topicType: input.topicType,
    topicKey: input.topicKey,
    eventTypes: input.eventTypes,
    filterExpr: input.filterExpr ?? null,
    createdByUserId: ctx.userId ?? null,
  });

  await ctx.sendEvent(
    createOutboxEventFromCtx(ctx, {
      type: SUBSCRIPTION_CREATED,
      subject: `subscription:${row.id}`,
      payload: {
        subscriptionId: row.id,
        channelId: row.channelId,
        botPluginInstanceId: row.botPluginInstanceId ?? null,
        connectionId: row.connectionId,
        ownerType: row.ownerType,
        ownerId: row.ownerId,
        topicType: row.topicType,
        topicKey: row.topicKey,
        eventTypes: row.eventTypes,
      },
    }),
  );

  return {
    subscription: row,
    created: true,
  };
}

export async function updateSubscriptionStatus(ctx: ServiceContext, id: string, status: string) {
  const updated = await ctx.repositories.subscription.updateSubscriptionStatus(id, status);
  if (!updated) throw new NotFoundError("subscription not found");

  if (status === "active") {
    await ctx.sendEvent(
      createOutboxEventFromCtx(ctx, {
        type: SUBSCRIPTION_ACTIVATED,
        subject: `subscription:${updated.id}`,
        payload: {
          subscriptionId: updated.id,
          channelId: updated.channelId,
          botPluginInstanceId: updated.botPluginInstanceId ?? null,
          connectionId: updated.connectionId,
          ownerType: updated.ownerType,
          ownerId: updated.ownerId,
          topicType: updated.topicType,
          topicKey: updated.topicKey,
          eventTypes: updated.eventTypes,
        },
      }),
    );
  }

  return updated;
}
