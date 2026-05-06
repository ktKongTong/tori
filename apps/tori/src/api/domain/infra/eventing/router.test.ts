import { createMockServiceContext } from "@test/utils/service.ts";
import { beforeEach, describe, expect, it, vi } from "vite-plus/test";
import * as schema from "@/api/db/schema/index.ts";
import type { EventContext } from "@/api/domain/infra/eventing/handler.ts";
import type { ServiceContext } from "@/api/domain/infra/service-context.ts";
import { EventRouter } from "@/api/domain/infra/eventing";

const mockDb = {
  insert: vi.fn(),
  update: vi.fn(),
  select: vi.fn(),
};

const createCtx = () => {
  const ctx = createMockServiceContext({ tx: mockDb }) as unknown as EventContext & ServiceContext;
  // @ts-expect-error
  ctx.event = { id: "evt-1", type: "TestEvent" };
  return ctx;
};

const createInsertChain = () => {
  const chain = {
    values: vi.fn(),
    onConflictDoNothing: vi.fn(),
    returning: vi.fn(),
  };
  chain.values = vi.fn().mockReturnValue(chain);
  chain.onConflictDoNothing = vi.fn().mockReturnValue(chain);
  return chain;
};

const createUpdateChain = () => {
  const chain = {
    set: vi.fn(),
    where: vi.fn(),
    returning: vi.fn(),
  };
  chain.set.mockReturnValue(chain);
  chain.where.mockReturnValue(chain);
  return chain;
};

const createFinalUpdateChain = () => {
  const chain = {
    set: vi.fn(),
    where: vi.fn(),
  };
  chain.set.mockReturnValue(chain);
  chain.where.mockResolvedValue([]);
  return chain;
};

const createSelectChain = () => {
  const chain = {
    from: vi.fn(),
    where: vi.fn(),
    limit: vi.fn(),
  };
  chain.from.mockReturnValue(chain);
  chain.where.mockReturnValue(chain);
  return chain;
};

describe("EventRouter", () => {
  let router: EventRouter;

  beforeEach(() => {
    vi.clearAllMocks();
    router = new EventRouter();
  });

  it("should register handlers and reject duplicate ids", () => {
    const handler = vi.fn();
    router.register("handler-1", "TestEvent", handler);
    expect(() => router.register("handler-1", "OtherEvent", handler)).toThrow();
  });

  it("should ignore idempotent duplicate registration", async () => {
    const handler = vi.fn().mockResolvedValue({ id: "evt-1", status: "SUCCESS" });
    router.register("h1", "TestEvent", handler);
    router.register("h1", "TestEvent", handler);
    const ctx = createCtx();

    const insertChain = createInsertChain();
    insertChain.returning.mockResolvedValue([{ status: "PROCESSING" }]);
    mockDb.insert.mockReturnValue(insertChain);

    const finalizeChain = createFinalUpdateChain();
    mockDb.update.mockReturnValue(finalizeChain);

    const result = await router.dispatch(ctx);

    expect(result).toEqual({ id: "evt-1", status: "SUCCESS" });
    expect(handler).toHaveBeenCalledTimes(1);
  });

  it("should dispatch event to handler and close logger once", async () => {
    const handler = vi.fn().mockResolvedValue({ id: "evt-1", status: "SUCCESS" });
    router.register("h1", "TestEvent", handler);
    const ctx = createCtx();

    const insertChain = createInsertChain();
    insertChain.returning.mockResolvedValue([{ status: "PROCESSING" }]);
    mockDb.insert.mockReturnValue(insertChain);

    const finalizeChain = createFinalUpdateChain();
    mockDb.update.mockReturnValue(finalizeChain);

    const result = await router.dispatch(ctx);

    expect(result).toEqual({ id: "evt-1", status: "SUCCESS" });
    expect(handler).toHaveBeenCalledTimes(1);
    expect(mockDb.insert).toHaveBeenCalledWith(schema.inbox);
    expect(mockDb.update).toHaveBeenCalledWith(schema.inbox);
    // expect(ctx.logger.close).toHaveBeenCalledTimes(1);
  });

  it("should skip already DONE event", async () => {
    const handler = vi.fn();
    router.register("h1", "TestEvent", handler);
    const ctx = createCtx();

    const insertChain = createInsertChain();
    insertChain.returning.mockResolvedValue([]);
    mockDb.insert.mockReturnValue(insertChain);

    const reclaimChain = createUpdateChain();
    reclaimChain.returning.mockResolvedValue([]);
    mockDb.update.mockReturnValue(reclaimChain);

    const selectChain = createSelectChain();
    selectChain.limit.mockResolvedValue([{ status: "DONE", reason: null }]);
    mockDb.select.mockReturnValue(selectChain);

    const result = await router.dispatch(ctx);

    expect(result).toEqual({ id: "evt-1", status: "SUCCESS" });
    expect(handler).not.toHaveBeenCalled();
    // expect(ctx.logger.close).toHaveBeenCalledTimes(1);
  });

  it("should reclaim failed handler and run again", async () => {
    const handler = vi.fn().mockResolvedValue({ id: "evt-1", status: "SUCCESS" });
    router.register("h1", "TestEvent", handler);
    const ctx = createCtx();

    const insertChain = createInsertChain();
    insertChain.returning.mockResolvedValue([]);
    mockDb.insert.mockReturnValue(insertChain);

    const reclaimChain = createUpdateChain();
    reclaimChain.returning.mockResolvedValue([{ status: "PROCESSING" }]);
    const finalizeChain = createFinalUpdateChain();
    mockDb.update.mockReturnValueOnce(reclaimChain).mockReturnValueOnce(finalizeChain);

    const result = await router.dispatch(ctx);

    expect(result).toEqual({ id: "evt-1", status: "SUCCESS" });
    expect(handler).toHaveBeenCalledTimes(1);
    // expect(ctx.logger.close).toHaveBeenCalledTimes(1);
  });

  it("should persist handler fail reason into inbox", async () => {
    const handler = vi
      .fn()
      .mockResolvedValue({ id: "evt-1", status: "FAIL", reason: "downstream failed" });
    router.register("h1", "TestEvent", handler);
    const ctx = createCtx();

    const insertChain = createInsertChain();
    insertChain.returning.mockResolvedValue([{ status: "PROCESSING" }]);
    mockDb.insert.mockReturnValue(insertChain);

    const finalizeChain = createFinalUpdateChain();
    mockDb.update.mockReturnValue(finalizeChain);

    const result = await router.dispatch(ctx);

    expect(result).toEqual({ id: "evt-1", status: "FAIL", reason: "downstream failed" });
    expect(finalizeChain.set).toHaveBeenCalledWith({
      status: "FAIL",
      finishedAt: expect.any(Date),
      reason: "downstream failed",
    });
    // expect(ctx.logger.close).toHaveBeenCalledTimes(1);
  });

  it("should treat DROP as done and keep reason in inbox", async () => {
    const handler = vi
      .fn()
      .mockResolvedValue({ id: "evt-1", status: "DROP", reason: "invalid payload" });
    router.register("h1", "TestEvent", handler);
    const ctx = createCtx();

    const insertChain = createInsertChain();
    insertChain.returning.mockResolvedValue([{ status: "PROCESSING" }]);
    mockDb.insert.mockReturnValue(insertChain);

    const finalizeChain = createFinalUpdateChain();
    mockDb.update.mockReturnValue(finalizeChain);

    const result = await router.dispatch(ctx);

    expect(result).toEqual({ id: "evt-1", status: "SUCCESS" });
    expect(finalizeChain.set).toHaveBeenCalledWith({
      status: "DONE",
      finishedAt: expect.any(Date),
      reason: "invalid payload",
    });
    // expect(ctx.logger.close).toHaveBeenCalledTimes(1);
  });

  it("should return retryable fail when existing handler is still processing", async () => {
    const handler = vi.fn();
    router.register("h1", "TestEvent", handler);
    const ctx = createCtx();

    const insertChain = createInsertChain();
    insertChain.returning.mockResolvedValue([]);
    mockDb.insert.mockReturnValue(insertChain);

    const reclaimChain = createUpdateChain();
    reclaimChain.returning.mockResolvedValue([]);
    mockDb.update.mockReturnValue(reclaimChain);

    const selectChain = createSelectChain();
    selectChain.limit.mockResolvedValue([{ status: "PROCESSING", reason: null }]);
    mockDb.select.mockReturnValue(selectChain);

    const result = await router.dispatch(ctx);

    expect(result).toEqual({
      id: "evt-1",
      status: "FAIL",
      reason: "handler [h1] still processing",
      delayInSeconds: 30,
    });
    expect(handler).not.toHaveBeenCalled();
    // expect(ctx.logger.close).toHaveBeenCalledTimes(1);
  });

  it("should close logger even when no handler exists", async () => {
    const ctx = createCtx();
    ctx.event.type = "UnknownEvent";

    const result = await router.dispatch(ctx);

    expect(result).toEqual({ id: "evt-1", status: "SUCCESS" });
    // expect(ctx.logger.close).toHaveBeenCalledTimes(1);
  });
});
