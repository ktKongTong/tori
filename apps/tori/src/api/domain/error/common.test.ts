import { describe, expect, it } from "vite-plus/test";
import type { StandardSchemaV1 } from "@standard-schema/spec";
import {
  FeatureGateError,
  RateLimitError,
  UnauthorizedError,
  ZodValidatorError,
} from "./common.js";
import { ErrorCode } from "./error-codes.js";

describe("domain error common", () => {
  it("creates UnauthorizedError with default semantics", () => {
    const err = new UnauthorizedError();
    expect(err.errorCode).toBe(ErrorCode.UNAUTHORIZED);
    expect(err.httpStatus).toBe(401);
    expect(err.message).toBe("Unauthorized");
  });

  it("stores retryAfter in RateLimitError detail", () => {
    const err = new RateLimitError(30);
    expect(err.errorCode).toBe(ErrorCode.RATE_LIMITED);
    expect(err.httpStatus).toBe(429);
    expect(err.detail).toEqual({ retryAfter: 30 });
  });

  it("creates FeatureGateError with default semantics", () => {
    const err = new FeatureGateError();
    expect(err.errorCode).toBe(ErrorCode.FEATURE_GATE_DISABLED);
    expect(err.httpStatus).toBe(503);
    expect(err.message).toBe("Feature is disabled");
  });

  it("keeps validation issues on ZodValidatorError", () => {
    const issues = [{ message: "invalid", path: ["a"] }] as StandardSchemaV1.Issue[];
    const err = new ZodValidatorError(issues);
    expect(err.errorCode).toBe(ErrorCode.VALIDATION_FAILED);
    expect(err.httpStatus).toBe(400);
    expect(err.issues).toBe(issues);
  });
});
