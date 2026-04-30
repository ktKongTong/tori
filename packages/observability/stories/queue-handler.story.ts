import { createQueueObserver } from "../src/context/queue.ts";
import { createPinoTransport } from "../src/logging/loglayer.ts";
import { createExecutionLogStoreTransport } from "../src/logging/sinks/store.ts";
import type {
  ExecutionLogChunk,
  ExecutionLogChunkQuery,
  ExecutionLogChunkQueryResult,
} from "../src/logging/event.ts";

type QueueMessage = {
  id: string;
  attempts: number;
  body: {
    executionId: string;
    steamAccountId: string;
    partition: string;
  };
};

type WorkerExecutionContext = {
  waitUntil(promise: Promise<unknown>): void;
};

type Env = {
  executionLogStore: ExecutionLogStoreAdapter;
};

export function createInventorySyncObserver(env: Env) {
  const storeTransport = createExecutionLogStoreTransport({
    store: env.executionLogStore,
    maxEvents: 100,
    maxBytes: 128 * 1024,
    flushIntervalMs: 3000,
  });

  return createQueueObserver<QueueMessage>({
    transports: [createPinoTransport(), storeTransport],
    executionId: (message) => message.body.executionId,
    entry: (message) => ({
      entryId: message.id,
      kind: "queue",
      attempt: message.attempts,
      partition: message.body.partition,
      messageId: message.id,
    }),
    scope: {
      service: "steam-bot",
      module: "inventory-worker",
      operation: "sync-inventory",
    },
    subject: (message) => ({
      type: "steam-account",
      id: message.body.steamAccountId,
    }),
    attrs: (message) => ({
      partition: message.body.partition,
      steamAccountId: message.body.steamAccountId,
    }),
    flush: (message) => storeTransport.flushEntry(message.body.executionId, message.id),
  });
}

export async function queueHandler(message: QueueMessage, env: Env, ctx: WorkerExecutionContext) {
  const observeQueue = createInventorySyncObserver(env);

  await observeQueue.run(message, ctx, async (observe) => {
    observe.log.info("inventory sync started");

    const inventory = await observe.step("fetch-steam-inventory", async (step) => {
      step.log.info("calling steam inventory api");
      return fetchSteamInventory(message.body.steamAccountId);
    });

    await observe.step("persist-inventory", async (step) => {
      step.log.info("persisting inventory", { count: inventory.length });
      await persistInventory(inventory);
      step.metric.histogram("inventory_sync.items", inventory.length);
    });
  });
}

export type ExecutionLogStoreAdapter = {
  appendChunk(chunk: ExecutionLogChunk): void | Promise<void>;
  queryChunks(input: ExecutionLogChunkQuery): Promise<ExecutionLogChunkQueryResult>;
};

async function fetchSteamInventory(steamAccountId: string) {
  return [{ id: `${steamAccountId}:item-1` }, { id: `${steamAccountId}:item-2` }];
}

async function persistInventory(_items: Array<{ id: string }>) {}
