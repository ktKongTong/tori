import type { ServiceContext } from "@/api/domain/infra/service-context";
import type { CreateTaskDefinitionInput } from "@/api/modules/platform/task/repository/repository";
import type { SubscriptionLifecyclePayload } from "./type";

export type SubscriptionTaskDefinitionInput = {
  ctx: ServiceContext;
  subscription: SubscriptionLifecyclePayload;
};

export type SubscriptionTaskDefinitionOutput = Omit<
  CreateTaskDefinitionInput,
  "id" | "enabled" | "metadata"
> & {
  metadata?: Record<string, unknown>;
};

export interface SubscriptionTaskDefinition {
  id: string;
  topicType: string;
  topicKey?: string;
  build: (input: SubscriptionTaskDefinitionInput) => SubscriptionTaskDefinitionOutput;
}

const subscriptionTaskDefinitions = new Map<string, SubscriptionTaskDefinition>();

export function defineSubscriptionTaskDefinition(
  definition: SubscriptionTaskDefinition,
): SubscriptionTaskDefinition {
  return definition;
}

export function registerSubscriptionTaskDefinitions(...definitions: SubscriptionTaskDefinition[]) {
  for (const definition of definitions) {
    if (subscriptionTaskDefinitions.has(definition.id)) {
      throw new Error(`Subscription task definition already registered: ${definition.id}`);
    }
    subscriptionTaskDefinitions.set(definition.id, definition);
  }
}

export function listSubscriptionTaskDefinitions(subscription: SubscriptionLifecyclePayload) {
  return [...subscriptionTaskDefinitions.values()].filter((definition) => {
    if (definition.topicType !== subscription.topicType) return false;
    return !definition.topicKey || definition.topicKey === subscription.topicKey;
  });
}
