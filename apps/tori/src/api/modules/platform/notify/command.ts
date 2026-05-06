import { NotFoundError, ParameterError } from "@/api/domain/error/index.ts";
import { createOutboxEventFromCtx } from "@/api/domain/infra";
import type { ServiceContext } from "@/api/domain/infra/service-context.ts";
import { uniqueId } from "@repo/utils/id";

import {
  type CreateSubscriptionInput,
  type RegisterDeliveryEndpointInput,
  SUBSCRIPTION_ACTIVATED,
  SUBSCRIPTION_CREATED,
} from "./type.js";

export async function registerDeliveryEndpoint(
  ctx: ServiceContext,
  input: RegisterDeliveryEndpointInput,
) {
  const existing = await ctx.repositories.notify.findDeliveryEndpointByTarget(input.target);

  if (existing) {
    return { deliveryEndpoint: existing, created: false };
  }

  const row = await ctx.repositories.notify.createDeliveryEndpoint({
    id: uniqueId(),
    ownerUserId: ctx.userId ?? null,
    platform: input.platform,
    kind: input.kind,
    target: input.target,
    displayName: input.displayName ?? null,
    secret: input.secret ?? null,
    config: input.config ?? null,
    metadata: input.metadata ?? null,
  });

  return { deliveryEndpoint: row, created: true };
}

export async function createSubscription(ctx: ServiceContext, input: CreateSubscriptionInput) {
  const channelBinding = await ctx.repositories.notify.findActiveChannelBindingByChannelId(
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

  const existing = await ctx.repositories.notify.findSubscriptionIdentity({
    channelId: input.channelId,
    connectionId: input.connectionId,
    botPluginInstanceId,
    topicType: input.topicType,
    topicKey: input.topicKey,
  });

  if (existing) {
    return { subscription: existing, created: false };
  }

  const row = await ctx.repositories.notify.createSubscription({
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

export async function updateDeliveryEndpointStatus(
  ctx: ServiceContext,
  id: string,
  status: string,
) {
  const updated = await ctx.repositories.notify.updateDeliveryEndpointStatus(id, status);
  if (!updated) throw new NotFoundError("delivery endpoint not found");

  return updated;
}

export async function updateSubscriptionStatus(ctx: ServiceContext, id: string, status: string) {
  const updated = await ctx.repositories.notify.updateSubscriptionStatus(id, status);
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
