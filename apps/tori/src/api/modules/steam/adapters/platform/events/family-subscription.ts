import type { EventRuntimeContext } from "@/api/domain/infra/eventing";
import { createEventConsumer } from "@/api/domain/infra/eventing";
import type { EventEnvelope } from "@/api/domain/infra/eventing/message";
import {
  SUBSCRIPTION_ACTIVATED,
  SUBSCRIPTION_CREATED,
  type SubscriptionLifecyclePayload,
} from "@/api/modules/platform/notify/type";
import { uniqueId } from "@repo/utils/id";

function isSteamFamilySubscription(
  payload: SubscriptionLifecyclePayload | null | undefined,
): payload is SubscriptionLifecyclePayload {
  return payload?.topicType === "steam.family" && Boolean(payload.connectionId);
}

async function ensureSteamFamilyRefreshTask(
  ctx: EventRuntimeContext<EventEnvelope<SubscriptionLifecyclePayload>>,
  payload: SubscriptionLifecyclePayload,
) {
  const ownerUserId = payload.ownerType === "USER" ? payload.ownerId : (ctx.userId ?? null);
  const existingTasks = await ctx.repositories.task.getTaskDefinitionsByKind(
    "steam.family.refresh_connection",
    ownerUserId,
  );
  const existingTask =
    existingTasks.find((taskDefinition: (typeof existingTasks)[number]) => {
      const taskPayload =
        taskDefinition.payload &&
        typeof taskDefinition.payload === "object" &&
        !Array.isArray(taskDefinition.payload)
          ? (taskDefinition.payload as Record<string, unknown>)
          : null;

      return taskPayload?.connectionId === payload.connectionId;
    }) ?? null;

  if (existingTask) return existingTask;

  return ctx.repositories.task.createTaskDefinition({
    id: uniqueId(),
    ownerUserId,
    kind: "steam.family.refresh_connection",
    enabled: true,
    schedule: "*/30 * * * *",
    payload: {
      connectionId: payload.connectionId,
    },
    metadata: {
      source: "steam.subscription.event",
      subscriptionId: payload.subscriptionId,
    },
  });
}

const steamFamilySubscriptionChangedConsumer = createEventConsumer<SubscriptionLifecyclePayload>(
  "steam.subscription.ensure-family-refresh-task",
  SUBSCRIPTION_CREATED,
  async (ctx) => {
    const payload = ctx.event.payload as EventEnvelope<SubscriptionLifecyclePayload>["payload"];
    if (!isSteamFamilySubscription(payload)) {
      return { id: ctx.event.id, status: "DROP", reason: "not steam.family subscription" };
    }

    await ensureSteamFamilyRefreshTask(ctx, payload);
    return { id: ctx.event.id, status: "SUCCESS" };
  },
);

const steamFamilySubscriptionActivatedConsumer = createEventConsumer<SubscriptionLifecyclePayload>(
  "steam.subscription.ensure-family-refresh-task-on-activation",
  SUBSCRIPTION_ACTIVATED,
  async (ctx) => {
    const payload = ctx.event.payload as EventEnvelope<SubscriptionLifecyclePayload>["payload"];
    if (!isSteamFamilySubscription(payload)) {
      return { id: ctx.event.id, status: "DROP", reason: "not steam.family subscription" };
    }

    await ensureSteamFamilyRefreshTask(ctx, payload);
    return { id: ctx.event.id, status: "SUCCESS" };
  },
);

export const steamSubscriptionEventConsumers = [
  steamFamilySubscriptionChangedConsumer,
  steamFamilySubscriptionActivatedConsumer,
];
