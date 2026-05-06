import type { StandardSchemaV1 } from "@standard-schema/spec";
import { BizError } from "./base.js";
import { ErrorCode } from "./error-codes.js";
export class EnvError extends BizError {
  constructor(message: string) {
    super(ErrorCode.ENV_ERROR, message, 500);
  }
}

export class UnauthorizedError extends BizError {
  constructor(message?: string) {
    super(ErrorCode.UNAUTHORIZED, message ?? "Unauthorized", 401);
  }
}

export class NotFoundError extends BizError {
  constructor(message?: string) {
    super(ErrorCode.NOT_FOUND, message ?? "Resource Not Found", 404);
  }
}

export class ParameterError extends BizError {
  constructor(message?: string) {
    super(ErrorCode.PARAMETER_ERROR, message ?? "Parameter Error", 400);
  }
}

export class FeatureGateError extends BizError {
  constructor(message?: string) {
    super(ErrorCode.FEATURE_GATE_DISABLED, message ?? "Feature is disabled", 503);
  }
}

export class StatusConflictError extends BizError {
  constructor(message?: string) {
    super(ErrorCode.STATUS_CONFLICT, message ?? "Status conflict, update failed", 409);
  }
}

export class ConcurrentUpdateError extends BizError {
  constructor(message?: string) {
    super(
      ErrorCode.CONCURRENT_UPDATE,
      message ?? "Concurrent update detected, please retry later",
      409,
    );
  }
}

export class NotImplementedError extends BizError {
  constructor(message?: string) {
    super(ErrorCode.NOT_IMPLEMENTED, message ?? "Not Implemented", 501);
  }
}

export class RateLimitError extends BizError {
  constructor(retryAfter: number) {
    super(ErrorCode.RATE_LIMITED, "Too many requests", 429);
    this.detail = { retryAfter };
  }
}

export class ZodValidatorError extends BizError {
  constructor(public issues: StandardSchemaV1.Issue[]) {
    super(ErrorCode.VALIDATION_FAILED, "Validation failed", 400);
  }
}
