import { createTaskEnvelope } from "@repo/task";
import { describe, expect, it } from "vite-plus/test";
import type {
  ExecutionLogChunk,
  ExecutionLogChunkQuery,
  ExecutionLogChunkQueryResult,
} from "../src/logging/event.ts";
import { createExecutionLogStoreTransport } from "../src/logging/sinks/store.ts";
import { createObserveRuntime } from "../src/runtime.ts";

describe("observe runtime", () => {
  it("runs observed entries with shared logger and flush", async () => {
    const store = createFakeExecutionLogStore();
    const transport = createExecutionLogStoreTransport({ store });
    const runtime = createObserveRuntime({
      scope: { service: "test", module: "runtime" },
      transports: [transport],
      flush: () => transport.flush(),
      now: fixedNow(),
    });

    await runtime.runEntry(
      {
        executionId: "exec-runtime",
        entry: { entryId: "entry-runtime", kind: "manual" },
      },
      async (observe) => {
        observe.log.info("runtime started");
        await observe.step("load", (step) => {
          step.log.info("runtime loaded");
        });
      },
    );

    const result = await transport.query({ executionId: "exec-runtime" });
    expect(result.events.map((event) => event.kind)).toEqual([
      "execution.started",
      "entry.started",
      "log",
      "step.started",
      "log",
      "step.completed",
      "entry.completed",
      "execution.completed",
    ]);
  });

  it("creates task queue observers from runtime defaults", async () => {
    const store = createFakeExecutionLogStore();
    const transport = createExecutionLogStoreTransport({ store });
    const runtime = createObserveRuntime({
      scope: { service: "test", module: "queue" },
      transports: [transport],
      flush: () => transport.flush(),
      now: fixedNow(),
    });
    const observer = runtime.taskQueue();

    await observer.run(
      {
        id: "message-1",
        task: createTaskEnvelope({
          taskId: "task-1",
          taskType: "inventory.sync",
          payload: { accountId: "account-1" },
          createdAt: new Date("2026-01-01T00:00:00.000Z"),
        }),
      },
      undefined,
      async (observe) => {
        observe.log.info("task observed");
      },
    );

    const result = await transport.query({ executionId: "task-1" });
    expect(result.events.find((event) => event.kind === "entry.started")?.entry?.kind).toBe(
      "queue",
    );
    expect(result.events.find((event) => event.message === "task observed")?.attrs).toMatchObject({
      taskType: "inventory.sync",
    });
  });
});

function createFakeExecutionLogStore() {
  const chunks: ExecutionLogChunk[] = [];
  return {
    appendChunk(chunk: ExecutionLogChunk) {
      chunks.push(chunk);
    },
    async queryChunks(input: ExecutionLogChunkQuery): Promise<ExecutionLogChunkQueryResult> {
      return {
        chunks: chunks.filter((chunk) => {
          if (input.executionId && chunk.executionId !== input.executionId) return false;
          if (input.entryId && chunk.entryId !== input.entryId) return false;
          return true;
        }),
      };
    },
  };
}

function fixedNow() {
  return () => new Date("2026-01-02T03:04:05.000Z");
}
