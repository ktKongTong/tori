import { createTaskEnvelope, taskEntryId, type TypedTaskEnvelope } from "@repo/task";
import { createTaskQueueObserver } from "../src/context/queue.ts";
import { createPinoTransport } from "../src/logging/loglayer.ts";
import {
  createExecutionLogStoreTransport,
  type ExecutionLogStore,
} from "../src/logging/sinks/store.ts";

type QueueMessage = {
  id: string;
  attempts: number;
  task: TypedTaskEnvelope<InventorySyncTaskPayload>;
};

type WorkerExecutionContext = {
  waitUntil(promise: Promise<unknown>): void;
};

type Env = {
  executionLogStore: ExecutionLogStore;
};

export function createInventorySyncObserver(env: Env) {
  const storeTransport = createExecutionLogStoreTransport({
    store: env.executionLogStore,
    maxEvents: 100,
    maxBytes: 128 * 1024,
    flushIntervalMs: 3000,
  });

  return createTaskQueueObserver<QueueMessage>({
    transports: [createPinoTransport(), storeTransport],
    scope: {
      service: "steam-bot",
      module: "inventory-worker",
      operation: "sync-inventory",
    },
    subject: (message) => ({
      type: "steam-account",
      id: message.task.payload.steamAccountId,
    }),
    attrs: (message) => ({
      partition: message.task.partition?.key,
      steamAccountId: message.task.payload.steamAccountId,
    }),
    flush: (message) => storeTransport.flushEntry(message.task.taskId, taskEntryId(message.task)),
  });
}

export async function queueHandler(message: QueueMessage, env: Env, ctx: WorkerExecutionContext) {
  const observeQueue = createInventorySyncObserver(env);

  await observeQueue.run(message, ctx, async (observe) => {
    observe.log.info("inventory sync started");

    const inventory = await observe.step("fetch-steam-inventory", async (step) => {
      step.log.info("calling steam inventory api");
      return fetchSteamInventory(message.task.payload.steamAccountId);
    });

    await observe.step("persist-inventory", async (step) => {
      step.log.info("persisting inventory", { count: inventory.length });
      await persistInventory(inventory);
      step.metric.histogram("inventory_sync.items", inventory.length);
    });
  });
}

export type InventorySyncTaskPayload = {
  steamAccountId: string;
};

export function createInventorySyncTask(input: {
  taskId: string;
  steamAccountId: string;
  partition: string;
  createdAt?: Date;
}) {
  return createTaskEnvelope({
    taskId: input.taskId,
    taskType: "inventory.sync",
    payload: {
      steamAccountId: input.steamAccountId,
    },
    createdAt: input.createdAt,
    partition: {
      key: input.partition,
    },
  });
}

async function fetchSteamInventory(steamAccountId: string) {
  return [{ id: `${steamAccountId}:item-1` }, { id: `${steamAccountId}:item-2` }];
}

async function persistInventory(_items: Array<{ id: string }>) {}
