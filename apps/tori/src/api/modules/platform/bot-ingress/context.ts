import { NotFoundError, ParameterError } from "@/api/domain/error/index.ts";
import type { ServiceContext } from "@/api/domain/infra/service-context.ts";
import {
  assertBindingGrantCanBeConsumed,
  issueBindingToken,
} from "@/api/modules/platform/binding/index.ts";
import type { ManagedBotPluginInstance } from "@/api/modules/platform/bot-plugin/instance.ts";
import { sha256Hash } from "@repo/utils/encoding/hash";
import { uniqueId } from "@repo/utils/id";

import { type BotIngressConnectionRow, getBotIngressRepository } from "./repository/index.js";
import type { MessageContextInput } from "./type.js";
import { resolveMessageContextNamespace } from "./type.js";

export type ResolvedBotContext = Awaited<ReturnType<typeof resolveOrCreateContext>>;
export type ActiveConnection = BotIngressConnectionRow;

async function hashToken(token: string) {
  return sha256Hash(token);
}

function deriveNamespace(messageContext: MessageContextInput) {
  return resolveMessageContextNamespace(messageContext);
}

function requireDisplayName(value: string, field: string) {
  const normalized = value.trim();
  if (!normalized) {
    throw new ParameterError(`${field} is required.`);
  }
  return normalized;
}

function createAnonymousDisplayName(observedUserName: string) {
  return `Pending ${requireDisplayName(observedUserName, "observedUserName")}`;
}

async function resolveContextBotInstanceId(
  ctx: ServiceContext,
  messageContext: MessageContextInput,
  options: { botPluginInstance?: ManagedBotPluginInstance | null },
) {
  if (options.botPluginInstance) {
    if (messageContext.platform === "playground" && !options.botPluginInstance.name?.trim()) {
      throw new ParameterError("Mock bot runtime display name is required.");
    }
    return options.botPluginInstance.id;
  }

  if (messageContext.platform !== "playground") {
    return null;
  }

  const [instance] = await getBotIngressRepository(ctx).listNamedActivePlaygroundBotInstances();
  if (!instance) {
    throw new ParameterError("Mock bot runtime with display name is required.");
  }

  return instance.id;
}

export function assertClaimSupportedMessageContext(messageContext: MessageContextInput) {
  if (messageContext.channelType !== "dm") {
    throw new ParameterError("/claim is only available in direct messages.");
  }
}

export async function resolveOrCreateContext(
  ctx: ServiceContext,
  messageContext: MessageContextInput,
  options: { botPluginInstance?: ManagedBotPluginInstance | null } = {},
) {
  const repository = getBotIngressRepository(ctx);
  const namespace = deriveNamespace(messageContext);
  const observedUserName = requireDisplayName(messageContext.observedUserName, "observedUserName");
  const observedChannelName = requireDisplayName(
    messageContext.observedChannelName,
    "observedChannelName",
  );
  const channelName = requireDisplayName(messageContext.channelName, "channelName");
  const anonymousDisplayName = createAnonymousDisplayName(observedUserName);

  const existingUserBinding = await repository.findActiveUserBindingIdentity({
    platform: messageContext.platform,
    externalUserId: messageContext.observedUserId,
    namespace,
  });
  const existingChannelBinding = await repository.findActiveChannelBindingIdentity({
    platform: messageContext.platform,
    externalChannelId: messageContext.observedChannelId,
    namespace,
  });

  const existingChannel = existingChannelBinding
    ? await repository.findChannelById(existingChannelBinding.channelId)
    : null;

  let anonymousUser = existingUserBinding
    ? await repository.findUserById(existingUserBinding.userId)
    : null;

  let userBinding = existingUserBinding ?? null;
  let channelBinding = existingChannelBinding ?? null;
  let created = false;
  const botPluginInstanceId = await resolveContextBotInstanceId(ctx, messageContext, options);

  if (!userBinding) {
    created = true;
    const anonymousUserId = uniqueId();

    anonymousUser = await repository.createAnonymousUser({
      id: anonymousUserId,
      name: anonymousDisplayName,
      email: `anonymous+${anonymousUserId}@tori.local`,
      emailVerified: false,
      createdAt: new Date(),
      updatedAt: new Date(),
      isAnonymous: true,
      status: "active",
      role: "user",
      banned: false,
    });

    userBinding = await repository.createUserBinding({
      id: uniqueId(),
      userId: anonymousUser.id,
      platform: messageContext.platform,
      externalUserId: messageContext.observedUserId,
      externalUserName: observedUserName,
      namespace,
      source: "bot-plugin",
      assurance: "self-asserted",
      metadata: messageContext.rawPayload ?? null,
    });
  } else if (userBinding.externalUserName !== observedUserName) {
    userBinding = await repository.updateUserBindingName(userBinding.id, observedUserName);
  }

  if (anonymousUser?.isAnonymous && anonymousUser.name !== anonymousDisplayName) {
    anonymousUser = await repository.updateAnonymousUserName(
      anonymousUser.id,
      anonymousDisplayName,
    );
  }

  if (!channelBinding) {
    created = true;
    const channel = await repository.createChannel({
      type: messageContext.channelType,
      name: channelName,
      metadata: {
        platform: messageContext.platform,
        externalChannelId: messageContext.observedChannelId,
        namespace,
      },
      createdByUserId: ctx.userId ?? null,
    });

    channelBinding = await repository.createChannelBinding({
      channelId: channel.id,
      platform: messageContext.platform,
      externalChannelId: messageContext.observedChannelId,
      externalChannelName: observedChannelName,
      namespace,
      botPluginInstanceId,
      source: "bot-plugin",
      assurance: "self-asserted",
      metadata: messageContext.rawPayload ?? null,
    });
  } else {
    if (
      channelBinding.externalChannelName !== observedChannelName ||
      channelBinding.botPluginInstanceId !== botPluginInstanceId
    ) {
      channelBinding = await repository.updateChannelBindingContext({
        id: channelBinding.id,
        externalChannelName: observedChannelName,
        botPluginInstanceId,
      });
    }

    if (existingChannel && existingChannel.name !== channelName) {
      await repository.updateChannelName(existingChannel.id, channelName);
    }
  }

  return {
    created,
    namespace,
    anonymousUser: anonymousUser?.isAnonymous ? anonymousUser : null,
    userBinding,
    channelBinding,
  };
}

export async function startClaimForContext(
  ctx: ServiceContext,
  messageContext: MessageContextInput,
  context: ResolvedBotContext,
) {
  assertClaimSupportedMessageContext(messageContext);
  const repository = getBotIngressRepository(ctx);
  const observedUserName = requireDisplayName(messageContext.observedUserName, "observedUserName");
  const observedChannelName = requireDisplayName(
    messageContext.observedChannelName,
    "observedChannelName",
  );

  if (!context.anonymousUser) {
    throw new ParameterError("Context is already claimed");
  }

  const pendingSessions = await repository.listPendingClaimSessionsForContext({
    anonymousUserId: context.anonymousUser.id,
    platform: messageContext.platform,
    observedUserId: messageContext.observedUserId,
    namespace: context.namespace,
  });
  await repository.cancelClaimSessionsAndGrants({
    sessionIds: pendingSessions.map((session) => session.id),
    grantIds: pendingSessions
      .map((session) => session.grantId)
      .filter((grantId): grantId is string => Boolean(grantId)),
  });

  const issued = await issueBindingToken(ctx, {
    purpose: "claim-user",
    subjectType: "user",
    subjectId: context.anonymousUser.id,
    issuedToSurface: "web",
    metadata: {
      platform: messageContext.platform,
      observedUserId: messageContext.observedUserId,
      observedChannelId: messageContext.observedChannelId,
      namespace: context.namespace,
    },
  });

  const claimSession = await repository.createClaimSession({
    id: uniqueId(),
    initiatedFrom: "bot-plugin",
    purpose: "claim-user",
    subjectType: "user",
    subjectId: context.anonymousUser.id,
    anonymousUserId: context.anonymousUser.id,
    anonymousUserName: context.anonymousUser.name,
    observedUserPlatform: messageContext.platform,
    observedUserId: messageContext.observedUserId,
    observedUserName,
    observedUserNamespace: context.namespace,
    observedChannelPlatform: messageContext.platform,
    observedChannelId: messageContext.observedChannelId,
    observedChannelName,
    observedChannelNamespace: context.namespace,
    grantId: issued.grant.id,
    status: "pending",
    resolvedChannelId: context.channelBinding.channelId,
    metadata: messageContext.rawPayload ?? null,
  });

  return { issued, claimSession };
}

export async function resolveActiveConnectionForContext(
  ctx: ServiceContext,
  context: ResolvedBotContext,
  provider?: string,
) {
  if (!context.userBinding?.userId) return null;

  return getBotIngressRepository(ctx).resolveActiveConnectionForUser({
    userId: context.userBinding.userId,
    provider,
  });
}

export async function findPendingClaimSessionForContext(
  ctx: ServiceContext,
  messageContext: MessageContextInput,
  context: ResolvedBotContext,
) {
  if (!context.anonymousUser) return null;

  return getBotIngressRepository(ctx).findPendingClaimSessionForContext({
    anonymousUserId: context.anonymousUser.id,
    platform: messageContext.platform,
    observedUserId: messageContext.observedUserId,
    namespace: context.namespace,
  });
}

export function renderConnectionSummary(connection: ActiveConnection) {
  return [
    `Provider: ${connection.provider}`,
    `Account: ${connection.providerAccountId}`,
    `Access: ${connection.accessMode}`,
    `Default: ${connection.isDefault ? "yes" : "no"}`,
    `Status: ${connection.status}`,
  ].join("\n");
}

export async function consumeBindingGrantForContext(
  ctx: ServiceContext,
  messageContext: MessageContextInput,
  context: ResolvedBotContext,
  token: string,
) {
  const repository = getBotIngressRepository(ctx);
  const tokenHash = await hashToken(token);
  const grant = await repository.findPendingBindingGrantByTokenHash(tokenHash);
  if (!grant) throw new NotFoundError("Binding token not found");

  assertBindingGrantCanBeConsumed(grant, {
    consumeSurface: "bot",
    allowedSubjectTypes: ["user"],
  });

  const now = new Date();

  if (grant.subjectType === "user") {
    if (context.userBinding?.userId === grant.subjectId) {
      await repository.markBindingGrantConsumed(grant.id, now);
      return grant;
    }

    if (!context.userBinding) {
      throw new ParameterError("User binding context is required.");
    }

    await repository.updateUserBindingIdentity(context.userBinding.id, {
      userId: grant.subjectId,
      source: "binding-grant",
      assurance: "token-confirmed",
      establishedByGrantId: grant.id,
      metadata: messageContext.rawPayload ?? null,
    });

    if (context.anonymousUser && context.anonymousUser.id !== grant.subjectId) {
      await repository.markAnonymousUserMerged({
        anonymousUserId: context.anonymousUser.id,
        targetUserId: grant.subjectId,
        now,
      });
    }
  } else {
    throw new ParameterError(`Unsupported binding subject type: ${grant.subjectType}`);
  }

  await repository.markBindingGrantConsumed(grant.id, now);

  return grant;
}
