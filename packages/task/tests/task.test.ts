import { describe, expect, it } from "vite-plus/test";
import { createTaskEnvelope, taskEntryId } from "../src/envelope.ts";
import { nextRetryDelayMs, shouldRetry } from "../src/retry.ts";
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
});
