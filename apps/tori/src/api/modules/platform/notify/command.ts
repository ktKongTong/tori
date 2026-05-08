import { NotFoundError } from "@/api/domain/error/index.ts";
import type { ServiceContext } from "@/api/domain/infra/service-context.ts";
import { uniqueId } from "@repo/utils/id";

import type { RegisterDeliveryEndpointInput } from "./type.js";

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

export async function updateDeliveryEndpointStatus(
  ctx: ServiceContext,
  id: string,
  status: string,
) {
  const updated = await ctx.repositories.notify.updateDeliveryEndpointStatus(id, status);
  if (!updated) throw new NotFoundError("delivery endpoint not found");

  return updated;
}
