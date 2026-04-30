import { createTaskEnvelope, taskEntryId } from "@repo/task";
import { describe, expect, it, vi } from "vite-plus/test";
import type {
  ExecutionLogChunk,
  ExecutionLogChunkQuery,
  ExecutionLogChunkQueryResult,
} from "../src/logging/event.ts";
import { createTaskQueueObserver } from "../src/context/queue.ts";
import { createExecutionLogger } from "../src/logging/execution.ts";
import { createExecutionLogLayer } from "../src/logging/loglayer.ts";
import { createArchiveLogTransport } from "../src/logging/sinks/archive.ts";
import { runObservedEntry } from "../src/context/index.ts";
import { createExecutionLogStoreTransport } from "../src/logging/sinks/store.ts";

describe("execution logging", () => {
  it("records execution, entry, step, and queryable events", async () => {
    const store = createFakeExecutionLogStore();
    const transport = createExecutionLogStoreTransport({ store });
    const execution = createExecutionLogger({
      executionId: "exec-1",
      scope: { service: "test", module: "worker" },
      subject: { type: "task", id: "task-1" },
      logger: createExecutionLogLayer({ transports: [transport] }),
      now: fixedNow(),
    });

    await execution.runEntry(
      { entryId: "msg-1", kind: "queue", attempt: 2, partition: "a", messageId: "msg-1" },
      async (entry) => {
        entry.info("entry body started");
        await entry.step("load", (log) => {
          log.info("loaded", { count: 2 });
        });
      },
    );

    execution.complete();

    await transport.flush();

    const result = await transport.query({ executionId: "exec-1", limit: 20 });
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
    expect(result.events.find((event) => event.stepId === "load")?.entryId).toBe("msg-1");
    expect(result.events.every((event) => event.scope.service === "test")).toBe(true);
    expect(store.chunks.length).toBeLessThan(result.events.length);
  });

  it("flushes chunks by size without writing every event", async () => {
    const store = createFakeExecutionLogStore();
    const transport = createExecutionLogStoreTransport({ store, maxEvents: 3 });
    const execution = createExecutionLogger({
      executionId: "exec-batch",
      scope: { service: "test" },
      logger: createExecutionLogLayer({ transports: [transport] }),
      now: fixedNow(),
    });

    await execution.runEntry({ entryId: "batch-entry", kind: "queue" }, (entry) => {
      entry.info("one");
      entry.info("two");
      entry.info("three");
      entry.info("four");
    });
    await transport.flush();

    const entryChunks = store.chunks.filter((chunk) => chunk.entryId === "batch-entry");
    expect(entryChunks.map((chunk) => chunk.eventCount)).toEqual([3, 3]);
    expect(store.chunks.length).toBeLessThan(7);
  });

  it("records entry and step failures", async () => {
    const store = createFakeExecutionLogStore();
    const transport = createExecutionLogStoreTransport({ store });
    const execution = createExecutionLogger({
      executionId: "exec-fail",
      scope: { service: "test" },
      logger: createExecutionLogLayer({ transports: [transport] }),
      now: fixedNow(),
    });

    await expect(
      execution.runEntry({ entryId: "msg-fail", kind: "queue" }, async (entry) => {
        await entry.step("explode", () => {
          throw new Error("boom");
        });
      }),
    ).rejects.toThrow("boom");

    await transport.flush();

    const result = await transport.query({ executionId: "exec-fail", level: "error" });
    expect(result.events.map((event) => event.kind)).toEqual(["step.failed", "entry.failed"]);
    expect(result.events[0]?.error?.message).toBe("boom");
  });

  it("archives entries independently and writes a manifest through LogLayer transports", async () => {
    const written = new Map<string, string>();
    const archive = createArchiveLogTransport({
      service: "svc",
      now: fixedNow(),
      writer: {
        write(key, body) {
          written.set(key, body);
        },
      },
    });
    const store = createFakeExecutionLogStore();
    const transport = createExecutionLogStoreTransport({ store });
    const execution = createExecutionLogger({
      executionId: "exec-archive",
      scope: { service: "svc" },
      logger: createExecutionLogLayer({ transports: [transport, archive] }),
      now: fixedNow(),
    });

    await execution.runEntry({ entryId: "part-a", kind: "queue", partition: "a" }, (entry) => {
      entry.info("a done");
    });
    await execution.runEntry({ entryId: "part-b", kind: "queue", partition: "b" }, (entry) => {
      entry.warn("b warning");
    });
    execution.complete();

    const manifest = await archive.finalizeExecution("exec-archive");
    expect(manifest.entries.map((entry) => entry.entryId)).toContain("part-a");
    expect(manifest.entries.map((entry) => entry.entryId)).toContain("part-b");
    expect(Array.from(written.keys()).some((key) => key.endsWith("entries/part-a.jsonl"))).toBe(
      true,
    );
    expect(Array.from(written.keys()).some((key) => key.endsWith("manifest.json"))).toBe(true);
  });
});

function createFakeExecutionLogStore() {
  const chunks: ExecutionLogChunk[] = [];
  return {
    chunks,
    appendChunk(chunk: ExecutionLogChunk) {
      chunks.push(chunk);
    },
    async queryChunks(input: ExecutionLogChunkQuery): Promise<ExecutionLogChunkQueryResult> {
      const limit = input.limit ?? 100;
      const cursorIndex = input.cursor
        ? chunks.findIndex((chunk) => chunk.chunkId === input.cursor)
        : -1;
      const startIndex = cursorIndex >= 0 ? cursorIndex + 1 : 0;
      const filtered = chunks.slice(startIndex).filter((chunk) => {
        if (input.executionId && chunk.executionId !== input.executionId) return false;
        if (input.entryId && chunk.entryId !== input.entryId) return false;
        if (input.level === "error" && !chunk.hasError) return false;
        return true;
      });
      const page = filtered.slice(0, limit);
      return {
        chunks: page,
        nextCursor: page.length === limit ? page.at(-1)?.chunkId : undefined,
      };
    },
  };
}

function fixedNow() {
  return () => new Date("2026-01-02T03:04:05.000Z");
}

it("exposes a unified observe context for business code", async () => {
  const store = createFakeExecutionLogStore();
  const transport = createExecutionLogStoreTransport({ store });

  await runObservedEntry(
    {
      executionId: "exec-observe",
      entry: { entryId: "message-observe", kind: "queue" },
      scope: { service: "test", module: "worker", operation: "observe" },
      logger: createExecutionLogLayer({ transports: [transport] }),
      attrs: { partition: "a" },
      flush: () => transport.flush(),
      now: fixedNow(),
    },
    async (observe) => {
      observe.log.info("business started");
      observe.metric.count("business.started");
      await observe.step("business-step", async (step) => {
        step.log.info("inside step");
      });
    },
  );

  const result = await transport.query({ executionId: "exec-observe" });
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
  expect(result.events.find((event) => event.message === "business started")?.attrs).toMatchObject({
    partition: "a",
  });
});

it("accepts task envelopes and raw execution context", async () => {
  const store = createFakeExecutionLogStore();
  const transport = createExecutionLogStoreTransport({ store });
  const waitUntil = vi.fn();
  const observer = createTaskQueueObserver({
    transports: [transport],
    scope: { service: "test", module: "queue" },
    subject: (message) => ({ type: "task", id: message.task.taskId }),
    flush: (message) => transport.flushEntry(message.task.taskId, taskEntryId(message.task)),
  });
  const task = createTaskEnvelope({
    taskId: "task-queue-1",
    taskType: "queue.process",
    payload: { accountId: "acct-1" },
    createdAt: new Date("2026-01-02T03:04:05.000Z"),
    partition: { key: "part-a" },
  });

  await observer.run(
    {
      id: "message-1",
      attempts: 2,
      task,
    },
    { waitUntil },
    async (observe) => {
      observe.log.info("task queue started");
    },
  );

  expect(waitUntil).toHaveBeenCalledTimes(1);

  const result = await transport.query({ executionId: "task-queue-1" });
  expect(
    result.events.find((event) => event.message === "task queue started")?.attrs,
  ).toMatchObject({
    taskType: "queue.process",
    taskPartition: "part-a",
  });
});
