import { createEventConsumer, createOutboxEventFromCtx } from "@/api/domain/infra";
import type { ServiceContext } from "@/api/domain/infra/service-context.ts";
import type { EventEnvelope } from "@/api/domain/infra/eventing/message.ts";

export const BOT_INSTANCE_DISABLED = "platform.bot-instance.disabled";
export const BOT_INSTANCE_DELETED = "platform.bot-instance.deleted";

type BotInstanceLifecyclePayload = {
  botInstanceId?: string;
};

export function createBotInstanceLifecycleEvent(
  ctx: ServiceContext,
  type: typeof BOT_INSTANCE_DISABLED | typeof BOT_INSTANCE_DELETED,
  botInstanceId: string,
) {
  return createOutboxEventFromCtx(ctx, {
    type,
    subject: `bot-instance:${botInstanceId}`,
    payload: { botInstanceId },
  });
}

export const disableDependentsForBotInstance = createEventConsumer<BotInstanceLifecyclePayload>(
  "platform.bot-instance.disabled",
  BOT_INSTANCE_DISABLED,
  async (ctx) => {
    const payload = ctx.event.payload as EventEnvelope<BotInstanceLifecyclePayload>["payload"];
    const botInstanceId = payload?.botInstanceId;
    if (!botInstanceId) return { id: ctx.event.id, status: "DROP", reason: "missing bot id" };

    await ctx.repositories.subscription.disableActiveSubscriptionsByBotPluginInstanceId(
      botInstanceId,
    );

    return { id: ctx.event.id, status: "SUCCESS" };
  },
);

export const revokeDependentsForDeletedBotInstance =
  createEventConsumer<BotInstanceLifecyclePayload>(
    "platform.bot-instance.deleted",
    BOT_INSTANCE_DELETED,
    async (ctx) => {
      const payload = ctx.event.payload as EventEnvelope<BotInstanceLifecyclePayload>["payload"];
      const botInstanceId = payload?.botInstanceId;
      if (!botInstanceId) return { id: ctx.event.id, status: "DROP", reason: "missing bot id" };

      await ctx.repositories.binding.revokeActiveChannelBindingsByBotPluginInstanceId(
        botInstanceId,
      );
      await ctx.repositories.subscription.disableActiveSubscriptionsByBotPluginInstanceId(
        botInstanceId,
      );

      return { id: ctx.event.id, status: "SUCCESS" };
    },
  );

export const platformBotInstanceConsumers = [
  disableDependentsForBotInstance,
  revokeDependentsForDeletedBotInstance,
];
