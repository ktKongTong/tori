import { createEventConsumer, createOutboxEventFromCtx } from "@/api/domain/infra";
import type { ServiceContext } from "@/api/domain/infra/service-context.ts";
import type { EventEnvelope } from "@/api/domain/infra/eventing/message.ts";
import { disableConnectionRuntimeDependents } from "@/api/modules/platform/connection/event.ts";

export const PROXY_INSTANCE_DISABLED = "platform.proxy-instance.disabled";
export const PROXY_INSTANCE_DELETED = "platform.proxy-instance.deleted";

type ProxyInstanceLifecyclePayload = {
  proxyInstanceId?: string;
};

export function createProxyInstanceLifecycleEvent(
  ctx: ServiceContext,
  type: typeof PROXY_INSTANCE_DISABLED | typeof PROXY_INSTANCE_DELETED,
  proxyInstanceId: string,
) {
  return createOutboxEventFromCtx(ctx, {
    type,
    subject: `proxy-instance:${proxyInstanceId}`,
    payload: { proxyInstanceId },
  });
}

async function disableConnectionsForProxyInstance(ctx: ServiceContext, proxyInstanceId: string) {
  const disabledConnections =
    await ctx.repositories.connection.disableActiveConnectionsByProxyInstanceId(proxyInstanceId);
  for (const connection of disabledConnections) {
    await disableConnectionRuntimeDependents(ctx, connection.id);
  }
}

export const disableConnectionsForProxy = createEventConsumer<ProxyInstanceLifecyclePayload>(
  "platform.proxy-instance.disabled",
  PROXY_INSTANCE_DISABLED,
  async (ctx) => {
    const payload = ctx.event.payload as EventEnvelope<ProxyInstanceLifecyclePayload>["payload"];
    const proxyInstanceId = payload?.proxyInstanceId;
    if (!proxyInstanceId) return { id: ctx.event.id, status: "DROP", reason: "missing proxy id" };

    await disableConnectionsForProxyInstance(ctx, proxyInstanceId);

    return { id: ctx.event.id, status: "SUCCESS" };
  },
);

export const disableConnectionsForDeletedProxy = createEventConsumer<ProxyInstanceLifecyclePayload>(
  "platform.proxy-instance.deleted",
  PROXY_INSTANCE_DELETED,
  async (ctx) => {
    const payload = ctx.event.payload as EventEnvelope<ProxyInstanceLifecyclePayload>["payload"];
    const proxyInstanceId = payload?.proxyInstanceId;
    if (!proxyInstanceId) return { id: ctx.event.id, status: "DROP", reason: "missing proxy id" };

    await disableConnectionsForProxyInstance(ctx, proxyInstanceId);

    return { id: ctx.event.id, status: "SUCCESS" };
  },
);

export const platformProxyInstanceConsumers = [
  disableConnectionsForProxy,
  disableConnectionsForDeletedProxy,
];
