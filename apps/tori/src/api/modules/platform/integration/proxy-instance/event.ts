import { createOutboxEventFromCtx } from "@/api/domain/infra";
import type { ServiceContext } from "@/api/domain/infra/service-context.ts";

export const PROXY_INSTANCE_DISABLED = "platform.proxy-instance.disabled";
export const PROXY_INSTANCE_DELETED = "platform.proxy-instance.deleted";

export type ProxyInstanceLifecyclePayload = {
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
