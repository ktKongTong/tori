import { describe, expect, it } from "vite-plus/test";
import { ConflictError, EnvError, RateLimitError } from "../src/errors/common.ts";
import { toDatabaseError } from "../src/errors/database.ts";
import { ErrorCode } from "../src/errors/error-codes.ts";
import {
  createCorrelationId,
  createSpanId,
  createTraceId,
  formatTraceparent,
  parseTraceparent,
} from "../src/utils/trace.ts";

describe("core errors", () => {
  it("creates common errors with stable status and code", () => {
    const conflict = ConflictError("idempotency conflict");
    expect(conflict).toMatchObject({
      _tag: "AppError",
      errorCode: ErrorCode.CONFLICT,
      httpStatus: 409,
      message: "idempotency conflict",
    });
    expect(EnvError("env invalid")).toMatchObject({
      errorCode: ErrorCode.ENV_ERROR,
      httpStatus: 500,
    });
  });

  it("stores retry metadata on rate limit errors", () => {
    const error = RateLimitError(30);
    expect(error.detail).toEqual({ retryAfter: 30 });
    expect(error.retryable).toBe(true);
  });

  it("maps database causes to safe application errors", () => {
    expect(toDatabaseError({ code: "23505" })).toMatchObject({
      errorCode: ErrorCode.DB_UNIQUE_VIOLATION,
      httpStatus: 409,
    });
    expect(toDatabaseError({ code: "99999" })).toMatchObject({
      errorCode: ErrorCode.DB_ERROR,
      httpStatus: 500,
    });
  });
});

describe("trace utilities", () => {
  it("creates and parses trace identifiers", () => {
    expect(createTraceId()).toMatch(/^[a-f0-9]{32}$/);
    expect(createSpanId()).toMatch(/^[a-f0-9]{16}$/);
    expect(createCorrelationId()).toMatch(/^[a-f0-9]{32}$/);
    expect(
      parseTraceparent(formatTraceparent("0123456789abcdef0123456789abcdef", "0123456789abcdef")),
    ).toEqual({
      traceId: "0123456789abcdef0123456789abcdef",
      spanId: "0123456789abcdef",
      flags: "01",
    });
  });
});
