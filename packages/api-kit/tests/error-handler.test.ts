import { ConflictError, EnvError } from "@repo/core/errors/common";
import { beforeEach, describe, expect, it, vi } from "vite-plus/test";
import { z } from "zod";
import { createErrorHandler } from "../src/index.ts";

function createMockContext() {
  return {
    get: vi.fn().mockReturnValue(undefined),
    json: vi.fn().mockImplementation((body, status) => ({ body, status })),
  } as any;
}

describe("createErrorHandler", () => {
  const logger = {
    debug: vi.fn(),
    error: vi.fn(),
  };

  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("logs 4xx application errors as debug", async () => {
    const context = createMockContext();
    const error = ConflictError("idempotency conflict");

    await createErrorHandler({ logger })(error, context);

    expect(logger.debug).toHaveBeenCalledTimes(1);
    expect(logger.debug.mock.calls[0]?.[0]).toMatchObject({ errorCode: "CONFLICT" });
    expect(logger.error).not.toHaveBeenCalled();
    expect(context.json).toHaveBeenCalledWith(
      { code: "CONFLICT", message: "idempotency conflict" },
      409,
    );
  });

  it("logs 5xx application errors as error", async () => {
    const context = createMockContext();
    const error = EnvError("env invalid");

    await createErrorHandler({ logger })(error, context);

    expect(logger.error).toHaveBeenCalledTimes(1);
    expect(logger.error.mock.calls[0]?.[0]).toMatchObject({ errorCode: "ENV_ERROR" });
    expect(context.json).toHaveBeenCalledWith({ code: "ENV_ERROR", message: "env invalid" }, 500);
  });

  it("normalizes Zod errors", async () => {
    const context = createMockContext();
    const result = z.object({ id: z.string() }).safeParse({ id: 1 });
    if (result.success) throw new Error("expected zod failure");

    await createErrorHandler({ logger })(result.error, context);

    expect(context.json.mock.calls[0][0]).toMatchObject({
      code: "VALIDATION_FAILED",
      message: "Validation failed",
    });
    expect(context.json.mock.calls[0][1]).toBe(400);
  });

  it("uses custom trace id resolver", async () => {
    const context = createMockContext();

    await createErrorHandler({ getTraceId: () => "trace-1" })(ConflictError(), context);

    expect(context.json).toHaveBeenCalledWith(
      { traceId: "trace-1", code: "CONFLICT", message: "Conflict" },
      409,
    );
  });
});
