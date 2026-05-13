import { StatusConflictError, UnauthorizedError } from "@/api/domain/error/index.ts";
import type { ServiceContext } from "@/api/domain/infra/service-context.ts";
import { sha256Hash } from "@repo/utils/encoding/hash";
import { uniqueId } from "@repo/utils/id";
import { randomCode } from "@repo/utils/random";
import type { PageBasedPaginationParam } from "@repo/utils/schema/paging";

import { getBotPluginRepository, type ManagedBotPluginInstance } from "./repository/index.js";
import {
  BOT_INSTANCE_DELETED,
  BOT_INSTANCE_DISABLED,
  createBotInstanceLifecycleEvent,
} from "@/api/modules/platform/bot-plugin/event.ts";
import type {
  AttachEndpointInput,
  CreateBotInstanceInput,
  UpdateBotInstanceInput,
} from "./type.js";

function createPlaintextCredential() {
  return randomCode("bpi", 24);
}

async function hashCredential(value: string) {
  return sha256Hash(value);
}

export type { ManagedBotPluginInstance };

export async function listManagedBotInstances(ctx: ServiceContext, page: PageBasedPaginationParam) {
  const userId = ctx.userId!;
  return getBotPluginRepository(ctx).listVisibleManagedBotInstances({ ownerUserId: userId }, page);
}

async function findManageableBotInstance(ctx: ServiceContext, id: string) {
  const instance = await getBotPluginRepository(ctx).findManagedBotInstanceById(id);
  if (!instance) throw new UnauthorizedError("Bot plugin instance not found");
  if (!ctx.isAdmin()) {
    throw new UnauthorizedError("Only admins can manage bot instances");
  }
  return instance;
}

export async function createManagedBotInstance(ctx: ServiceContext, body: CreateBotInstanceInput) {
  const userId = ctx.userId!;
  const repository = getBotPluginRepository(ctx);
  const credential = createPlaintextCredential();
  const credentialHash = await hashCredential(credential);

  if (body.platform === "playground") {
    const activeMock = await repository.findActiveMockBotInstance();
    if (activeMock)
      throw new StatusConflictError("platform default playground bot instance already exists");
  }

  const existing = await repository.findManagedBotInstanceIdentity({
    ownerUserId: userId,
    platform: body.platform,
    namespace: body.namespace,
    instanceKey: body.instanceKey,
  });

  let endpointId: string | null = existing?.deliveryEndpointId ?? null;
  if (!existing && body.deliveryEndpoint) {
    const endpoint = await repository.createInternalDeliveryEndpoint({
      id: uniqueId(),
      ownerUserId: userId,
      platform: body.platform,
      kind: body.deliveryEndpoint.kind,
      target: body.deliveryEndpoint.target,
      name: body.deliveryEndpoint.name ?? body.name ?? null,
      secret: body.deliveryEndpoint.secret ?? null,
      config: body.deliveryEndpoint.config ?? null,
      metadata: body.deliveryEndpoint.metadata ?? { source: "bot-instance-create" },
    });
    endpointId = endpoint.id;
  }

  if (existing) {
    const updated = await repository.updateManagedBotInstanceRegistration({
      id: existing.id,
      name: body.name ?? existing.name ?? null,
      capabilities: body.capabilities ?? (existing.capabilities as Record<string, unknown> | null),
      credentialHash,
    });
    return { instance: updated, plaintextCredential: credential, created: false };
  }

  const instance = await repository.createManagedBotInstance({
    id: uniqueId(),
    ownerUserId: userId,
    platform: body.platform,
    namespace: body.namespace,
    instanceKey: body.instanceKey,
    name: body.name,
    deliveryEndpointId: endpointId,
    capabilities: body.capabilities ?? null,
    metadata: {
      runtimeCredentialHash: credentialHash,
      credentialRotatedAt: new Date().toISOString(),
    },
  });

  return { instance, plaintextCredential: credential, created: true };
}

export async function updateManagedBotInstance(
  ctx: ServiceContext,
  id: string,
  body: UpdateBotInstanceInput,
) {
  await findManageableBotInstance(ctx, id);
  const updated = await getBotPluginRepository(ctx).updateManagedBotInstance({
    id,
    name: body.name,
    capabilities: body.capabilities,
    status: body.status,
  });
  if (!updated) throw new UnauthorizedError("Bot plugin instance not found");
  if (body.status === "disabled") {
    await ctx.sendEvent(createBotInstanceLifecycleEvent(ctx, BOT_INSTANCE_DISABLED, updated.id));
  }
  return updated;
}

export async function rotateManagedBotInstanceCredential(ctx: ServiceContext, id: string) {
  const repository = getBotPluginRepository(ctx);
  await findManageableBotInstance(ctx, id);
  const credential = createPlaintextCredential();
  const credentialHash = await hashCredential(credential);
  await repository.rotateManagedBotInstanceCredential({ id, credentialHash });
  return { id, plaintextCredential: credential };
}

export async function authenticateManagedBotInstance(
  ctx: ServiceContext,
  credential: string,
): Promise<ManagedBotPluginInstance | null> {
  const repository = getBotPluginRepository(ctx);
  const credentialHash = await hashCredential(credential);
  const instance = await repository.findActiveManagedBotInstanceByCredentialHash(credentialHash);

  if (!instance) return null;

  return repository.markManagedBotInstanceSeen(instance.id);
}

export async function revokeManagedBotInstance(ctx: ServiceContext, id: string) {
  const repository = getBotPluginRepository(ctx);
  await findManageableBotInstance(ctx, id);
  const revoked = await repository.revokeManagedBotInstance(id);
  await ctx.sendEvent(createBotInstanceLifecycleEvent(ctx, BOT_INSTANCE_DELETED, revoked.id));
  return revoked;
}

export async function deleteManagedBotInstance(ctx: ServiceContext, id: string) {
  const repository = getBotPluginRepository(ctx);
  await findManageableBotInstance(ctx, id);

  const deleted = await repository.deleteManagedBotInstance(id);
  if (!deleted) throw new UnauthorizedError("Bot plugin instance not found");

  await ctx.sendEvent(createBotInstanceLifecycleEvent(ctx, BOT_INSTANCE_DELETED, deleted.id));

  return {
    id: deleted.id,
    status: "deleted",
  };
}

export async function attachManagedBotInstanceEndpoint(
  ctx: ServiceContext,
  id: string,
  body: AttachEndpointInput,
) {
  await findManageableBotInstance(ctx, id);
  const updated = await getBotPluginRepository(ctx).attachManagedBotInstanceEndpoint({
    id,
    deliveryEndpointId: body.deliveryEndpointId,
  });
  if (!updated) throw new UnauthorizedError("Bot plugin instance not found");
  return updated;
}
