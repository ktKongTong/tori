import { describe, expect, it, vi } from "vite-plus/test";
import type { EventRuntimeContext } from "@/api/domain/infra/eventing";
import type { EventEnvelope } from "@/api/domain/infra/eventing/message";
import {
  SUBSCRIPTION_CREATED,
  SUBSCRIPTION_DISABLED,
  type SubscriptionLifecyclePayload,
} from "@/api/modules/platform/subscription/type";
import { platformSubscriptionConsumers } from "./event";
import {
  defineSubscriptionTaskDefinition,
  registerSubscriptionTaskDefinitions,
} from "./task-definition";

const createdConsumer = platformSubscriptionConsumers.find(
  (consumer) => consumer.id === "platform.subscription.ensure-task-definitions",
);
const disabledConsumer = platformSubscriptionConsumers.find(
  (consumer) => consumer.id === "platform.subscription.disable-task-definitions",
);

function createEventPayload(
  overrides: Partial<SubscriptionLifecyclePayload> = {},
): SubscriptionLifecyclePayload {
  return {
    subscriptionId: "sub-1",
    channelId: "channel-1",
    connectionId: "connection-1",
    ownerType: "USER",
    ownerId: "user-1",
    topicType: "test.topic",
    topicKey: "*",
    eventTypes: ["test.event"],
    ...overrides,
  };
}

function createDisabledContext(input: { disabledTaskIds?: string[] }) {
  const disableTaskDefinitionsByMetadataSubscriptionId = vi
    .fn()
    .mockResolvedValue(input.disabledTaskIds ?? ["task-1"]);
  const cancelPendingTaskRunsByTaskDefinitionIds = vi.fn().mockResolvedValue(1);
  const ctx = {
    event: {
      id: "evt-1",
      type: SUBSCRIPTION_DISABLED,
      source: null,
      specVersion: "1.0",
      timestamp: BigInt(0),
      correlationId: "corr-1",
      causationId: "cause-1",
      causationType: "event",
      traceparent: null,
      tracestate: null,
      actor: "user:user-1",
      subject: "subscription:sub-1",
      payload: createEventPayload(),
      extensions: null,
    },
    repositories: {
      task: {
        disableTaskDefinitionsByMetadataSubscriptionId,
        cancelPendingTaskRunsByTaskDefinitionIds,
      },
    },
  } as unknown as EventRuntimeContext<EventEnvelope<SubscriptionLifecyclePayload>>;

  return {
    ctx,
    disableTaskDefinitionsByMetadataSubscriptionId,
    cancelPendingTaskRunsByTaskDefinitionIds,
  };
}

describe("platform subscription lifecycle consumers", () => {
  it("creates task definitions declared for a created subscription", async () => {
    registerSubscriptionTaskDefinitions(
      defineSubscriptionTaskDefinition({
        id: "test.topic.refresh",
        topicType: "test.topic",
        build: ({ subscription }) => ({
          ownerUserId: subscription.ownerId,
          kind: "test.refresh",
          schedule: "*/5 * * * *",
          payload: { connectionId: subscription.connectionId },
          metadata: { provider: "test" },
        }),
      }),
    );
    const listTaskDefinitionsByMetadataSubscriptionId = vi.fn().mockResolvedValue([]);
    const createTaskDefinition = vi.fn().mockResolvedValue({ id: "task-1" });
    const ctx = {
      userId: "user-1",
      event: {
        id: "evt-1",
        type: SUBSCRIPTION_CREATED,
        source: null,
        specVersion: "1.0",
        timestamp: BigInt(0),
        correlationId: "corr-1",
        causationId: "cause-1",
        causationType: "event",
        traceparent: null,
        tracestate: null,
        actor: "user:user-1",
        subject: "subscription:sub-1",
        payload: createEventPayload(),
        extensions: null,
      },
      repositories: {
        task: {
          listTaskDefinitionsByMetadataSubscriptionId,
          createTaskDefinition,
        },
      },
    } as unknown as EventRuntimeContext<EventEnvelope<SubscriptionLifecyclePayload>>;

    await createdConsumer?.handler(ctx);

    expect(listTaskDefinitionsByMetadataSubscriptionId).toHaveBeenCalledWith("sub-1");
    expect(createTaskDefinition).toHaveBeenCalledWith({
      ownerUserId: "user-1",
      kind: "test.refresh",
      enabled: true,
      schedule: "*/5 * * * *",
      payload: { connectionId: "connection-1" },
      metadata: {
        provider: "test",
        source: "platform.subscription",
        subscriptionId: "sub-1",
        subscriptionTaskDefinitionId: "test.topic.refresh",
      },
    });
  });

  it("disables task definitions derived from a disabled subscription", async () => {
    const {
      ctx,
      disableTaskDefinitionsByMetadataSubscriptionId,
      cancelPendingTaskRunsByTaskDefinitionIds,
    } = createDisabledContext({ disabledTaskIds: ["task-1"] });

    await disabledConsumer?.handler(ctx);

    expect(disableTaskDefinitionsByMetadataSubscriptionId).toHaveBeenCalledWith("sub-1");
    expect(cancelPendingTaskRunsByTaskDefinitionIds).toHaveBeenCalledWith(["task-1"]);
  });
});
