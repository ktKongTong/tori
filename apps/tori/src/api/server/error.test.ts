import { beforeEach, describe, expect, it, vi } from "vite-plus/test";

vi.mock("@repo/observability/logging", () => ({
  pinoLogger: {
    error: vi.fn(),
    debug: vi.fn(),
    warn: vi.fn(),
  },
}));

import { EnvError, StatusConflictError } from "../domain/error/common.js";
import { pinoLogger } from "@repo/observability/logging";
import { errorHandler } from "./error.js";

function createMockContext() {
  return {
    get: vi.fn().mockReturnValue(undefined),
    header: vi.fn(),
    json: vi.fn().mockImplementation((body, status) => ({ body, status })),
  } as any;
}

describe("errorHandler logging level policy", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("should log 4xx BizError as debug", async () => {
    const ctx = createMockContext();
    const err = new StatusConflictError("idempotency conflict");

    await errorHandler(err, ctx);

    expect(pinoLogger.debug).toHaveBeenCalledWith(err);
    expect(pinoLogger.error).not.toHaveBeenCalled();
    expect(ctx.json).toHaveBeenCalledWith(
      { code: "STATUS_CONFLICT", message: "idempotency conflict" },
      409,
    );
  });

  it("should log 5xx BizError as error", async () => {
    const ctx = createMockContext();
    const err = new EnvError("env invalid");

    await errorHandler(err, ctx);

    expect(pinoLogger.error).toHaveBeenCalledWith(err);
    expect(pinoLogger.warn).not.toHaveBeenCalled();
    expect(ctx.json).toHaveBeenCalledWith({ code: "ENV_ERROR", message: "env invalid" }, 500);
  });
});
