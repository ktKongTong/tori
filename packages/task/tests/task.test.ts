import { describe, expect, it } from "vite-plus/test";
import { createTaskEnvelope, taskEntryId } from "../src/envelope.ts";
import { nextRetryDelayMs, shouldRetry } from "../src/retry.ts";
import { createTaskRuntime } from "../src/runtime.ts";
import { taskEnvelopeSchema } from "../src/schema.ts";

describe("task", () => {
  it("creates typed task envelopes", () => {
    const envelope = createTaskEnvelope({
      taskId: "task-1",
      taskType: "inventory.sync",
      payload: { accountId: "a" },
      createdAt: new Date("2026-01-01T00:00:00.000Z"),
      partition: { key: "part-a" },
    });

    expect(taskEnvelopeSchema.parse(envelope).taskId).toBe("task-1");
    expect(taskEntryId(envelope)).toBe("task-1:part-a");
  });

  it("calculates retry decisions", () => {
    expect(shouldRetry(2, { maxAttempts: 3, baseDelayMs: 100 })).toBe(true);
    expect(shouldRetry(3, { maxAttempts: 3, baseDelayMs: 100 })).toBe(false);
    expect(nextRetryDelayMs(3, { maxAttempts: 5, baseDelayMs: 100, maxDelayMs: 350 })).toBe(350);
  });

  it("runs registered handlers through a small task runtime", async () => {
    const runtime = createTaskRuntime({
      now: () => new Date("2026-01-01T00:00:00.000Z"),
      handlers: {
        "inventory.sync": (task) => ({ synced: task.payload }),
      },
    });
    const task = createTaskEnvelope({
      taskId: "task-run",
      taskType: "inventory.sync",
      payload: { accountId: "account-1" },
      createdAt: new Date("2026-01-01T00:00:00.000Z"),
    });

    await expect(runtime.run(task)).resolves.toMatchObject({
      taskId: "task-run",
      taskType: "inventory.sync",
      status: "success",
      result: { synced: { accountId: "account-1" } },
    });
  });

  it("returns retry metadata when handlers fail", async () => {
    const runtime = createTaskRuntime({
      now: () => new Date("2026-01-01T00:00:00.000Z"),
      random: () => 0,
      retryPolicy: { maxAttempts: 3, baseDelayMs: 1000 },
      handlers: {
        "inventory.sync": () => {
          throw new Error("boom");
        },
      },
    });
    const task = createTaskEnvelope({
      taskId: "task-fail",
      taskType: "inventory.sync",
      payload: {},
      attempt: { attempt: 1, maxAttempts: 3 },
      createdAt: new Date("2026-01-01T00:00:00.000Z"),
    });

    await expect(runtime.run(task)).resolves.toMatchObject({
      taskId: "task-fail",
      status: "failed",
      retry: {
        attempt: 2,
        delayMs: 1000,
        scheduledAt: "2026-01-01T00:00:01.000Z",
      },
    });
  });
});
