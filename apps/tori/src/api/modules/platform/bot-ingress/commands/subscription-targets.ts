import type { ServiceContext } from "@/api/domain/infra/service-context.ts";
import type { ResolvedBotContext } from "../context.js";
import { getBotIngressRepository } from "../repository/index.js";
import type { MessageContextInput } from "../type.js";

export type ResolvedSubscriptionTarget = {
  provider: string;
  resource: string;
  channelId: string;
  botPluginInstanceId: string;
  connectionId: string;
  ownerType: "USER" | "CHANNEL";
  ownerId: string;
  topicType: string;
  topicKey: string;
  eventTypes: string[];
};

export type ResolveSubscriptionTargetInput = {
  args: string[];
  options: Map<string, string>;
  messageContext: MessageContextInput;
};

export type SubscriptionTargetResolution =
  | {
      kind: "applied";
      target: ResolvedSubscriptionTarget;
    }
  | {
      kind: "invalid-owner";
      owner: string;
    }
  | {
      kind: "invalid-event";
      event: string;
    }
  | {
      kind: "unavailable";
      provider: string;
    }
  | {
      kind: "requires-token-connection";
      provider: string;
      resource: string;
    };

export interface SubscriptionTargetDefinition {
  provider: string;
  resource: string;
  resolve: (
    ctx: ServiceContext,
    context: ResolvedBotContext,
    input: ResolveSubscriptionTargetInput,
  ) => Promise<SubscriptionTargetResolution>;
}

const targetDefinitions = new Map<string, SubscriptionTargetDefinition>();

function buildKey(provider: string, resource: string) {
  return `${provider.trim().toLowerCase()} ${resource.trim().toLowerCase()}`;
}

export function defineSubscriptionTarget(
  definition: SubscriptionTargetDefinition,
): SubscriptionTargetDefinition {
  return definition;
}

export function registerSubscriptionTargets(...definitions: SubscriptionTargetDefinition[]) {
  for (const definition of definitions) {
    const key = buildKey(definition.provider, definition.resource);
    if (targetDefinitions.has(key)) {
      throw new Error(`Subscription target already registered: ${key}`);
    }
    targetDefinitions.set(key, definition);
  }
}

export function getSubscriptionTarget(provider: string, resource: string) {
  return targetDefinitions.get(buildKey(provider, resource)) ?? null;
}

export async function findMatchingSubscription(
  ctx: ServiceContext,
  target: ResolvedSubscriptionTarget,
) {
  return getBotIngressRepository(ctx).findMatchingSubscription(target);
}
