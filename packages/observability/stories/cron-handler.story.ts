import { createCronObserver } from "../src/context/cron.ts";
import { createPinoTransport } from "../src/logging/loglayer.ts";
import { createExecutionLogStoreTransport } from "../src/logging/sinks/store.ts";
import type { ExecutionLogStoreAdapter } from "./queue-handler.story.ts";

type ScheduledEvent = {
  cron: string;
  scheduledTime: number;
};

type WorkerExecutionContext = {
  waitUntil(promise: Promise<unknown>): void;
};

type Env = {
  executionLogStore: ExecutionLogStoreAdapter;
};

export function createDailyCleanupObserver(env: Env) {
  const storeTransport = createExecutionLogStoreTransport({
    store: env.executionLogStore,
    maxEvents: 100,
    maxBytes: 128 * 1024,
    flushIntervalMs: 3000,
  });

  return createCronObserver<ScheduledEvent>({
    transports: [createPinoTransport(), storeTransport],
    scope: {
      service: "steam-bot",
      module: "cron",
      operation: "daily-cleanup",
    },
    executionId: (event) => `daily-cleanup:${event.scheduledTime}`,
    subject: (event) => ({
      type: "cron",
      id: event.cron,
    }),
    attrs: (event) => ({
      job: "daily-cleanup",
      cron: event.cron,
      scheduledAt: new Date(event.scheduledTime).toISOString(),
    }),
    flush: (event) => storeTransport.flushEntry(`daily-cleanup:${event.scheduledTime}`),
  });
}

export async function scheduled(event: ScheduledEvent, env: Env, ctx: WorkerExecutionContext) {
  const observeCron = createDailyCleanupObserver(env);

  await observeCron.run(event, ctx, async (observe) => {
    observe.log.info("daily cleanup started");
    observe.metric.count("daily_cleanup.started");

    const expiredSessions = await observe.step("load-expired-sessions", async (step) => {
      const sessions = await loadExpiredSessions();
      step.log.info("loaded expired sessions", { count: sessions.length });
      return sessions;
    });

    await observe.step("delete-expired-sessions", async (step) => {
      await deleteExpiredSessions(expiredSessions);
      step.metric.histogram("daily_cleanup.deleted_sessions", expiredSessions.length);
      step.log.info("deleted expired sessions", { count: expiredSessions.length });
    });

    observe.log.info("daily cleanup completed");
  });
}

async function loadExpiredSessions() {
  return [{ id: "session-1" }, { id: "session-2" }];
}

async function deleteExpiredSessions(_sessions: Array<{ id: string }>) {}
