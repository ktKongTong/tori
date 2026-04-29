import { createAppError, type AppError, type AppErrorInit } from "./base.ts";
import { ErrorCode } from "./error-codes.ts";

function createCommonError(
  errorCode: AppError["errorCode"],
  httpStatus: number,
  fallbackMessage: string,
  init?: string | AppErrorInit,
): AppError {
  const options = typeof init === "string" ? { message: init } : init;
  return createAppError({
    errorCode,
    httpStatus,
    message: options?.message ?? fallbackMessage,
    detail: options?.detail,
    retryable: options?.retryable,
  });
}

export function EnvError(message: string, init?: Omit<AppErrorInit, "message">): AppError {
  return createAppError({
    errorCode: ErrorCode.ENV_ERROR,
    httpStatus: 500,
    message,
    detail: init?.detail,
    retryable: init?.retryable,
  });
}

export function UnauthorizedError(init?: string | AppErrorInit): AppError {
  return createCommonError(ErrorCode.UNAUTHORIZED, 401, "Unauthorized", init);
}

export function ForbiddenError(init?: string | AppErrorInit): AppError {
  return createCommonError(ErrorCode.FORBIDDEN, 403, "Forbidden", init);
}

export function NotFoundError(init?: string | AppErrorInit): AppError {
  return createCommonError(ErrorCode.NOT_FOUND, 404, "Resource Not Found", init);
}

export function ParameterError(init?: string | AppErrorInit): AppError {
  return createCommonError(ErrorCode.PARAMETER_ERROR, 400, "Parameter Error", init);
}

export function ConflictError(init?: string | AppErrorInit): AppError {
  return createCommonError(ErrorCode.CONFLICT, 409, "Conflict", init);
}

export function NotImplementedError(init?: string | AppErrorInit): AppError {
  return createCommonError(ErrorCode.NOT_IMPLEMENTED, 501, "Not Implemented", init);
}

export function RateLimitError(retryAfter: number): AppError {
  return createAppError({
    errorCode: ErrorCode.RATE_LIMITED,
    httpStatus: 429,
    message: "Too many requests",
    detail: { retryAfter },
    retryable: true,
  });
}
