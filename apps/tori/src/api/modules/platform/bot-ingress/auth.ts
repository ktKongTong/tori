import { createMiddleware } from "hono/factory";
import { UnauthorizedError } from "@/api/domain/error/index.ts";
import type { ServiceContext } from "@/api/domain/infra/service-context.ts";
import {
  authenticateManagedBotInstance,
  type ManagedBotPluginInstance,
} from "@/api/modules/platform/bot-plugin/instance.ts";

import type { MessageContextInput } from "./type.js";
import { resolveMessageContextNamespace } from "./type.js";

declare module "hono" {
  interface ContextVariableMap {
    botPluginInstance: ManagedBotPluginInstance | null;
  }
}

const BOT_PLUGIN_CREDENTIAL_HEADER = "x-bot-plugin-credential";

function resolveBearerCredential(header: string | null | undefined) {
  if (!header) return null;
  const [scheme, ...rest] = header.trim().split(/\s+/);
  if (scheme?.toLowerCase() !== "bearer") return null;
  const credential = rest.join(" ").trim();
  return credential || null;
}

export function extractBotPluginCredential(headers: Headers) {
  const explicitCredential = headers.get(BOT_PLUGIN_CREDENTIAL_HEADER)?.trim();
  if (explicitCredential) return explicitCredential;

  return resolveBearerCredential(headers.get("authorization"));
}

function applyBotPluginActor(ctx: ServiceContext, instance: ManagedBotPluginInstance) {
  ctx.userId = instance.ownerUserId;
  ctx.role = ctx.role ?? "user";
  ctx.user =
    ctx.user ??
    ({
      id: instance.ownerUserId,
      role: "user",
    } as never);
}

export function assertBotPluginMessageContextAccess(
  instance: ManagedBotPluginInstance,
  messageContext: MessageContextInput,
) {
  if (messageContext.platform !== instance.platform) {
    throw new UnauthorizedError("Bot plugin credential does not match messageContext.platform");
  }

  const messageNamespace = resolveMessageContextNamespace(messageContext);
  const instanceNamespace = resolveMessageContextNamespace({ namespace: instance.namespace });

  if (messageNamespace !== instanceNamespace) {
    throw new UnauthorizedError("Bot plugin credential does not match messageContext.namespace");
  }
}

export const requireBotIngressAccess = () =>
  createMiddleware(async (c, next) => {
    c.set("botPluginInstance", null);

    const ctx = c.get("serviceContext");
    if (ctx.userId) {
      await next();
      return;
    }

    const credential = extractBotPluginCredential(c.req.raw.headers);
    if (!credential) throw new UnauthorizedError("Bot plugin credential required");

    const instance = await authenticateManagedBotInstance(ctx, credential);
    if (!instance) throw new UnauthorizedError("Bot plugin credential invalid");

    applyBotPluginActor(ctx, instance);
    c.set("botPluginInstance", instance);
    await next();
  });
