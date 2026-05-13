import { ofetch } from "ofetch";
import { NotFoundError, ParameterError } from "@/api/domain/error/index.ts";
import type { ServiceContext } from "@/api/domain/infra/service-context.ts";
import { uniqueId } from "@repo/utils/id";
import type { ProbeProxyInstanceResult, RegisterProxyInstanceInput } from "./type.js";
import {
  createProxyInstanceLifecycleEvent,
  PROXY_INSTANCE_DELETED,
  PROXY_INSTANCE_DISABLED,
} from "./event.ts";

async function probeProxy(
  baseUrl: string,
  credentialRef: string,
): Promise<ProbeProxyInstanceResult> {
  const normalizedBaseUrl = baseUrl.replace(/\/+$/, "");
  const health = await ofetch<{ status: string }>(`${normalizedBaseUrl}/health`, {
    retry: 0,
    timeout: 8000,
  }).catch(() => null);

  if (!health || health.status !== "ok") {
    throw new ParameterError("Token-proxy health probe failed");
  }

  const providerResponse = await ofetch<{
    providers?: Array<{ name?: string; flow?: string; grant_type?: string }>;
  }>(`${normalizedBaseUrl}/oauth/providers`, {
    retry: 0,
    timeout: 8000,
    headers: {
      "X-Admin-Key": credentialRef,
    },
  }).catch(async () =>
    ofetch<{
      providers?: Array<{ name?: string; flow?: string; grant_type?: string }>;
    }>(`${normalizedBaseUrl}/oauth/providers`, {
      retry: 0,
      timeout: 8000,
    }),
  );

  const providers =
    providerResponse.providers?.map((provider) => ({
      name: provider.name ?? "unknown",
      flow: provider.flow ?? "unknown",
      grantType: provider.grant_type ?? "unknown",
    })) ?? [];

  return {
    healthStatus: "healthy",
    providers,
    capabilities: {
      providers,
      features: {
        health: true,
        oauthProviders: providers.length > 0,
      },
    },
  };
}

export async function registerProxyInstance(
  ctx: ServiceContext,
  input: RegisterProxyInstanceInput,
) {
  const userId = ctx.userId;
  if (!userId) throw new NotFoundError("user not found");
  const probe = await probeProxy(input.baseUrl, input.credentialRef);
  const normalizedBaseUrl = input.baseUrl.replace(/\/+$/, "");

  const existing = await ctx.repositories.integration.findProxyInstanceByOwnerAndBaseUrl({
    ownerUserId: userId,
    baseUrl: normalizedBaseUrl,
  });

  if (existing) {
    const updated = await ctx.repositories.integration.updateProxyInstanceRegistration({
      id: existing.id,
      credentialRef: input.credentialRef,
      name: input.name ?? existing.name ?? null,
      healthStatus: probe.healthStatus,
      capabilities: probe.capabilities,
      metadata: input.metadata ?? null,
    });
    return { proxyInstance: updated, created: false, probe };
  }

  const row = await ctx.repositories.integration.createProxyInstance({
    id: uniqueId(),
    ownerUserId: userId,
    provider: "multi",
    baseUrl: normalizedBaseUrl,
    credentialRef: input.credentialRef,
    name: input.name ?? null,
    healthStatus: probe.healthStatus,
    capabilities: probe.capabilities,
    metadata: input.metadata ?? null,
  });

  return { proxyInstance: row, created: true, probe };
}

export async function probeProxyInstance(ctx: ServiceContext, proxyInstanceId: string) {
  const userId = ctx.userId;
  if (!userId) throw new NotFoundError("user not found");

  const proxyInstance = ctx.isAdmin()
    ? await ctx.repositories.integration.findProxyInstanceById(proxyInstanceId)
    : await ctx.repositories.integration.findProxyInstanceForOwner({
        id: proxyInstanceId,
        ownerUserId: userId,
      });

  if (!proxyInstance) throw new NotFoundError("proxy instance not found");

  const probe = await probeProxy(proxyInstance.baseUrl, proxyInstance.credentialRef);

  const updated = await ctx.repositories.integration.updateProxyInstanceProbe({
    id: proxyInstance.id,
    healthStatus: probe.healthStatus,
    capabilities: probe.capabilities,
  });

  return { proxyInstance: updated, probe };
}

export async function updateProxyInstanceStatus(
  ctx: ServiceContext,
  proxyInstanceId: string,
  status: "active" | "disabled",
) {
  const userId = ctx.userId;
  if (!userId) throw new NotFoundError("user not found");

  const proxyInstance = ctx.isAdmin()
    ? await ctx.repositories.integration.findProxyInstanceById(proxyInstanceId)
    : await ctx.repositories.integration.findProxyInstanceForOwner({
        id: proxyInstanceId,
        ownerUserId: userId,
      });
  if (!proxyInstance) throw new NotFoundError("proxy instance not found");

  const updated = await ctx.repositories.integration.updateProxyInstanceStatus({
    id: proxyInstanceId,
    ownerUserId: proxyInstance.ownerUserId,
    status,
  });

  if (!updated) throw new NotFoundError("proxy instance not found");

  if (status === "disabled") {
    await ctx.sendEvent(
      createProxyInstanceLifecycleEvent(ctx, PROXY_INSTANCE_DISABLED, updated.id),
    );
  }

  return updated;
}

export async function deleteProxyInstance(ctx: ServiceContext, proxyInstanceId: string) {
  const userId = ctx.userId;
  if (!userId) throw new NotFoundError("user not found");

  const proxy = ctx.isAdmin()
    ? await ctx.repositories.integration.findProxyInstanceById(proxyInstanceId)
    : await ctx.repositories.integration.findProxyInstanceForOwner({
        id: proxyInstanceId,
        ownerUserId: userId,
      });
  if (!proxy) throw new NotFoundError("proxy instance not found");

  await ctx.repositories.connection.deleteTokenProxyConnectionSessionsByProxyInstanceId(proxy.id);

  const deleted = await ctx.repositories.integration.deleteProxyInstance({
    id: proxy.id,
    ownerUserId: proxy.ownerUserId,
  });
  if (!deleted) throw new NotFoundError("proxy instance not found");

  await ctx.sendEvent(createProxyInstanceLifecycleEvent(ctx, PROXY_INSTANCE_DELETED, deleted.id));

  return {
    id: deleted.id,
    status: "deleted",
  };
}
