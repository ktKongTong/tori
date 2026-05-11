import { createEventConsumer, createOutboxEventFromCtx } from "@/api/domain/infra";
import type { ServiceContext } from "@/api/domain/infra/service-context.ts";
import type { EventEnvelope } from "@/api/domain/infra/eventing/message.ts";

export const CONNECTION_DISABLED = "platform.connection.disabled";
export const CONNECTION_DELETED = "platform.connection.deleted";

type ConnectionLifecyclePayload = {
  connectionId?: string;
};

export function createConnectionLifecycleEvent(
  ctx: ServiceContext,
  type: typeof CONNECTION_DISABLED | typeof CONNECTION_DELETED,
  connectionId: string,
) {
  return createOutboxEventFromCtx(ctx, {
    type,
    subject: `connection:${connectionId}`,
    payload: { connectionId },
  });
}

export async function disableConnectionRuntimeDependents(
  ctx: ServiceContext,
  connectionId: string,
) {
  await ctx.repositories.subscription.disableActiveSubscriptionsByConnectionId(connectionId);
  const disabledTaskIds =
    await ctx.repositories.task.disableTaskDefinitionsByPayloadConnectionId(connectionId);
  await ctx.repositories.task.cancelPendingTaskRunsByTaskDefinitionIds(disabledTaskIds);
}

export const disableDependentsForConnection = createEventConsumer<ConnectionLifecyclePayload>(
  "platform.connection.disabled",
  CONNECTION_DISABLED,
  async (ctx) => {
    const payload = ctx.event.payload as EventEnvelope<ConnectionLifecyclePayload>["payload"];
    const connectionId = payload?.connectionId;
    if (!connectionId) return { id: ctx.event.id, status: "DROP", reason: "missing connection id" };

    await disableConnectionRuntimeDependents(ctx, connectionId);

    return { id: ctx.event.id, status: "SUCCESS" };
  },
);

export const cleanupDeletedConnection = createEventConsumer<ConnectionLifecyclePayload>(
  "platform.connection.deleted",
  CONNECTION_DELETED,
  async (ctx) => {
    const payload = ctx.event.payload as EventEnvelope<ConnectionLifecyclePayload>["payload"];
    const connectionId = payload?.connectionId;
    if (!connectionId) return { id: ctx.event.id, status: "DROP", reason: "missing connection id" };

    await ctx.repositories.connection.deleteConnectionCredentialsByConnectionId(connectionId);
    await ctx.repositories.connection.deleteTokenProxyConnectionSessionsByConnectionId(
      connectionId,
    );
    await disableConnectionRuntimeDependents(ctx, connectionId);

    return { id: ctx.event.id, status: "SUCCESS" };
  },
);

export const platformConnectionConsumers = [
  disableDependentsForConnection,
  cleanupDeletedConnection,
];
