import { createEventConsumer, createOutboxEventFromCtx } from "@/api/domain/infra";
import type { ServiceContext } from "@/api/domain/infra/service-context.ts";
import type { EventEnvelope } from "@/api/domain/infra/eventing/message.ts";

export const CHANNEL_BINDING_REVOKED = "platform.channel-binding.revoked";

type ChannelBindingLifecyclePayload = {
  channelBindingId?: string;
  channelId?: string;
};

export function createChannelBindingRevokedEvent(
  ctx: ServiceContext,
  input: { channelBindingId: string; channelId: string },
) {
  return createOutboxEventFromCtx(ctx, {
    type: CHANNEL_BINDING_REVOKED,
    subject: `channel-binding:${input.channelBindingId}`,
    payload: input,
  });
}

export const disableSubscriptionsForChannelBinding =
  createEventConsumer<ChannelBindingLifecyclePayload>(
    "platform.channel-binding.revoked",
    CHANNEL_BINDING_REVOKED,
    async (ctx) => {
      const payload = ctx.event.payload as EventEnvelope<ChannelBindingLifecyclePayload>["payload"];
      const channelId = payload?.channelId;
      if (!channelId) return { id: ctx.event.id, status: "DROP", reason: "missing channel id" };

      await ctx.repositories.subscription.disableActiveSubscriptionsByChannelId(channelId);

      return { id: ctx.event.id, status: "SUCCESS" };
    },
  );

export const platformBindingConsumers = [disableSubscriptionsForChannelBinding];
