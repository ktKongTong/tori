import { StatusConflictError, UnauthorizedError } from "@/api/domain/error/index.ts";
import type { ServiceContext } from "@/api/domain/infra/service-context.ts";
import { sha256Hash } from "@repo/utils/encoding/hash";
import { uniqueId } from "@repo/utils/id";
import { randomCode } from "@repo/utils/random";

import { getBotPluginRepository, type ManagedBotPluginInstance } from "./repository/index.js";
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

export async function listManagedBotInstances(ctx: ServiceContext) {
  const userId = ctx.userId!;
  return getBotPluginRepository(ctx).listManagedBotInstances(userId);
}

export async function createManagedBotInstance(ctx: ServiceContext, body: CreateBotInstanceInput) {
  const userId = ctx.userId!;
  const repository = getBotPluginRepository(ctx);
  const credential = createPlaintextCredential();
  const credentialHash = await hashCredential(credential);

  if (body.platform === "mock") {
    const activeMock = await repository.findActiveMockBotInstance();
    if (activeMock)
      throw new StatusConflictError("platform default mock bot instance already exists");
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
      displayName: body.deliveryEndpoint.displayName ?? body.displayName ?? null,
      secret: body.deliveryEndpoint.secret ?? null,
      config: body.deliveryEndpoint.config ?? null,
      metadata: body.deliveryEndpoint.metadata ?? { source: "bot-instance-create" },
    });
    endpointId = endpoint.id;
  } else if (!existing && body.autoCreateInternalEndpoint === true) {
    const target = `internal://bot-plugin-instance/${body.platform}/${body.namespace}/${body.instanceKey}`;
    const endpoint = await repository.createInternalDeliveryEndpoint({
      id: uniqueId(),
      ownerUserId: userId,
      platform: body.platform,
      kind: "internal",
      target,
      displayName: body.displayName ?? null,
      metadata: { source: "bot-instance-create" },
    });
    endpointId = endpoint.id;
  }

  if (existing) {
    const updated = await repository.updateManagedBotInstanceRegistration({
      id: existing.id,
      displayName: body.displayName ?? existing.displayName ?? null,
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
    displayName: body.displayName ?? null,
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
  const updated = await getBotPluginRepository(ctx).updateManagedBotInstance({
    id,
    displayName: body.displayName,
    capabilities: body.capabilities,
    status: body.status,
  });
  if (!updated) throw new UnauthorizedError("Bot plugin instance not found");
  return updated;
}

export async function rotateManagedBotInstanceCredential(ctx: ServiceContext, id: string) {
  const repository = getBotPluginRepository(ctx);
  const instance = await repository.findManagedBotInstanceById(id);
  if (!instance) throw new UnauthorizedError("Bot plugin instance not found");
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
  const instance = await repository.findManagedBotInstanceById(id);
  if (!instance) throw new UnauthorizedError("Bot plugin instance not found");
  return repository.revokeManagedBotInstance(id);
}

export async function attachManagedBotInstanceEndpoint(
  ctx: ServiceContext,
  id: string,
  body: AttachEndpointInput,
) {
  const updated = await getBotPluginRepository(ctx).attachManagedBotInstanceEndpoint({
    id,
    deliveryEndpointId: body.deliveryEndpointId,
  });
  if (!updated) throw new UnauthorizedError("Bot plugin instance not found");
  return updated;
}
