import { createEventConsumer } from "@/api/domain/infra/eventing";
import type { EventEnvelope } from "@/api/domain/infra/eventing/message";
import {
  SUBSCRIPTION_ACTIVATED,
  SUBSCRIPTION_CREATED,
  SUBSCRIPTION_DISABLED,
  type SubscriptionLifecyclePayload,
} from "@/api/modules/platform/notification/subscription/type";
import { listSubscriptionTaskDefinitions } from "./task-definition";

function getSubscriptionTaskDefinitionId(metadata: unknown) {
  if (!metadata || typeof metadata !== "object" || Array.isArray(metadata)) return null;
  const value = (metadata as Record<string, unknown>).subscriptionTaskDefinitionId;
  return typeof value === "string" ? value : null;
}

const ensureTaskDefinitionsForSubscription = createEventConsumer<SubscriptionLifecyclePayload>(
  "platform.subscription.ensure-task-definitions",
  SUBSCRIPTION_CREATED,
  async (ctx) => {
    const payload = ctx.event.payload as EventEnvelope<SubscriptionLifecyclePayload>["payload"];
    if (!payload?.subscriptionId) {
      return { id: ctx.event.id, status: "DROP", reason: "missing subscription id" };
    }

    const definitions = listSubscriptionTaskDefinitions(payload);
    const existingTasks = await ctx.repositories.task.listTaskDefinitionsByMetadataSubscriptionId(
      payload.subscriptionId,
    );

    for (const definition of definitions) {
      const task = definition.build({ ctx, subscription: payload });
      const metadata = {
        ...task.metadata,
        source: "platform.subscription",
        subscriptionId: payload.subscriptionId,
        subscriptionTaskDefinitionId: definition.id,
      };
      const existingTask =
        existingTasks.find(
          (item) => getSubscriptionTaskDefinitionId(item.metadata) === definition.id,
        ) ?? null;

      if (existingTask) {
        await ctx.repositories.task.updateTaskDefinition(existingTask.id, {
          enabled: true,
          schedule: task.schedule,
          payload: task.payload,
          metadata,
        });
      } else {
        await ctx.repositories.task.createTaskDefinition({
          ownerUserId:
            task.ownerUserId ??
            (payload.ownerType === "USER" ? payload.ownerId : (ctx.userId ?? null)),
          kind: task.kind,
          enabled: true,
          schedule: task.schedule,
          payload: task.payload,
          metadata,
        });
      }
    }

    return { id: ctx.event.id, status: "SUCCESS" };
  },
);

const restoreTaskDefinitionsForSubscription = createEventConsumer<SubscriptionLifecyclePayload>(
  "platform.subscription.restore-task-definitions",
  SUBSCRIPTION_ACTIVATED,
  ensureTaskDefinitionsForSubscription.handler,
);

const disableTaskDefinitionsForSubscription = createEventConsumer<SubscriptionLifecyclePayload>(
  "platform.subscription.disable-task-definitions",
  SUBSCRIPTION_DISABLED,
  async (ctx) => {
    const payload = ctx.event.payload as EventEnvelope<SubscriptionLifecyclePayload>["payload"];
    const subscriptionId = payload?.subscriptionId;
    if (!subscriptionId) {
      return { id: ctx.event.id, status: "DROP", reason: "missing subscription id" };
    }

    const disabledTaskIds =
      await ctx.repositories.task.disableTaskDefinitionsByMetadataSubscriptionId(subscriptionId);
    await ctx.repositories.task.cancelPendingTaskRunsByTaskDefinitionIds(disabledTaskIds);

    return { id: ctx.event.id, status: "SUCCESS" };
  },
);

export const platformSubscriptionConsumers = [
  ensureTaskDefinitionsForSubscription,
  restoreTaskDefinitionsForSubscription,
  disableTaskDefinitionsForSubscription,
];
