import { afterEach, beforeEach, describe, expect, it, vi } from "vite-plus/test";
import { CronRouter, type ScheduledCtx } from "../../domain/infra/cron.ts";
import type { Auth, DB, ENV, IKV, IMQ, ServiceContext } from "../../domain/infra/index.ts";
import type { LoggerFactory } from "../../domain/infra/logger.ts";

const loggerError = vi.fn();

const loggerFactory: LoggerFactory = () => ({
  debug() {},
  error: loggerError,
  info() {},
  warn() {},
});

class FakeDB {}
class FakeAuth {}
class FakeKV {}
class FakeMQ implements IMQ {
  async publish(): Promise<void> {}
  async publishBatch(): Promise<void> {}
}

const fakeEnv: ENV = {
  ENVIRONMENT: "test",
  BETTER_AUTH_SECRET: "secret",
  RESEND_TOKEN: "resend-token",
  ADMIN_EMAIL: "admin@example.com",
  ADMIN_NAME: "Admin",
  CREDENTIAL_SECRET: "credential-secret",
};

const fakeServiceContext = {
  logger: loggerFactory({
    traceId: "trace",
    spanId: "span",
    correlationId: "correlation",
    source: "test",
  }),
} satisfies Pick<ServiceContext, "logger">;

const createScheduledCtx = (cron = "* * * * *"): ScheduledCtx => ({
  cron,
  db: new FakeDB() as DB,
  env: fakeEnv,
  auth: new FakeAuth() as Auth,
  kv: new FakeKV() as IKV,
  queue: new FakeMQ(),
});

describe("CronRouter", () => {
  let router: CronRouter;

  beforeEach(() => {
    router = new CronRouter({
      loggerFactory,
      createContext: () => fakeServiceContext as ServiceContext,
    });
    vi.useFakeTimers();
    vi.clearAllMocks();
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it("should register a handler", () => {
    const handler = { handler: vi.fn(), id: "handler" };
    router.register("* * * * *", handler);
  });

  it("should ignore idempotent duplicate registration", async () => {
    const handler = { handler: vi.fn(), id: "handler" };
    router.register("* * * * *", handler);
    router.register("* * * * *", handler);

    vi.setSystemTime(new Date("2024-01-01T12:00:00Z"));
    await router.handle(createScheduledCtx());

    expect(handler.handler).toHaveBeenCalledTimes(1);
  });

  it("should reject conflicting duplicate ids", () => {
    router.register("* * * * *", { handler: vi.fn(), id: "handler" });
    expect(() => router.register("*/5 * * * *", { handler: vi.fn(), id: "handler" })).toThrow(
      "CronHandlerId Conflict handler",
    );
  });

  it("should execute handler if cron matches current time", async () => {
    const handler = { handler: vi.fn(), id: "handler" };
    router.register("* * * * *", handler);

    vi.setSystemTime(new Date("2024-01-01T12:00:00Z"));
    await router.handle(createScheduledCtx());

    expect(handler.handler).toHaveBeenCalled();
  });

  it("should NOT execute handler if cron does not match", async () => {
    const handler = { handler: vi.fn(), id: "handler" };
    router.register("5 12 * * *", handler);

    vi.setSystemTime(new Date("2024-01-01T12:00:00Z"));
    await router.handle(createScheduledCtx());

    expect(handler.handler).not.toHaveBeenCalled();
  });

  it("should handle multiple handlers", async () => {
    const h1 = { handler: vi.fn(), id: "h1" };
    const h2 = { handler: vi.fn(), id: "h2" };
    router.register("* * * * *", h1);
    router.register("* * * * *", h2);

    vi.setSystemTime(new Date("2024-01-01T12:00:00Z"));
    await router.handle(createScheduledCtx());

    expect(h1.handler).toHaveBeenCalled();
    expect(h2.handler).toHaveBeenCalled();
  });

  it("should continue executing other handlers when one rejects", async () => {
    const okHandler = { handler: vi.fn(), id: "ok-handler" };
    router.register("* * * * *", {
      handler: async () => {
        throw new Error("boom");
      },
      id: "handle",
    });
    router.register("* * * * *", okHandler);

    vi.setSystemTime(new Date("2024-01-01T12:00:00Z"));
    await expect(router.handle(createScheduledCtx())).resolves.toBeUndefined();

    expect(okHandler.handler).toHaveBeenCalled();
    expect(loggerError).toHaveBeenCalledWith("cron trigger handler error", {
      cron: "* * * * *",
      error: "boom",
    });
  });
});
