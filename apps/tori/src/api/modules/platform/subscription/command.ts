import { NotFoundError } from "@/api/domain/error/index.ts";
import { createOutboxEventFromCtx } from "@/api/domain/infra";
import type { ServiceContext } from "@/api/domain/infra/service-context.ts";
import { uniqueId } from "@repo/utils/id";
import {
  type CreateSubscriptionInput,
  SUBSCRIPTION_ACTIVATED,
  SUBSCRIPTION_CREATED,
} from "./type.ts";

export async function createSubscription(ctx: ServiceContext, input: CreateSubscriptionInput) {
  const connection = await ctx.repositories.connection.findActiveConnectionById(input.connectionId);
  if (!connection) {
    throw new NotFoundError("connection not found");
  }

  const ownerId = input.ownerId ?? ctx.userId ?? input.channelId;

  const existing = await ctx.repositories.subscription.findSubscriptionIdentity({
    channelId: input.channelId,
    connectionId: input.connectionId,
    ownerType: input.ownerType,
    ownerId,
    topicType: input.topicType,
    topicKey: input.topicKey,
  });

  if (existing) {
    return { subscription: existing, created: false };
  }

  const row = await ctx.repositories.subscription.createSubscription({
    id: uniqueId(),
    channelId: input.channelId,
    connectionId: input.connectionId,
    ownerType: input.ownerType,
    ownerId,
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

export async function updateSubscriptionStatus(
  ctx: ServiceContext,
  id: string,
  status: "active" | "disabled",
) {
  if (status === "active") {
    const existing = await ctx.repositories.subscription.findSubscriptionById(id);
    const connection = await ctx.repositories.connection.findActiveConnectionById(
      existing.connectionId,
    );
    if (!connection) {
      throw new NotFoundError("connection not found");
    }
  }

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
