import { Result, TaggedError, matchError, matchErrorPartial } from "better-result";
import type { ErrorCodeValue } from "./error-codes.ts";

export type SerializableErrorDetail =
  | null
  | boolean
  | number
  | string
  | SerializableErrorDetail[]
  | { [key: string]: SerializableErrorDetail | undefined };

export type AppErrorShape = {
  errorCode: ErrorCodeValue;
  message: string;
  httpStatus: number;
  detail?: SerializableErrorDetail;
  retryable?: boolean;
};

export type AppErrorInit = {
  message: string;
  detail?: SerializableErrorDetail;
  retryable?: boolean;
};

export class AppError extends TaggedError("AppError")<AppErrorShape>() {}

export type AppResult<T, E = AppError> = Result<T, E>;

export const ok = Result.ok;
export const err = Result.err;
export { Result, matchError, matchErrorPartial };

export function createAppError(input: AppErrorShape): AppError {
  return new AppError({
    retryable: false,
    ...input,
  });
}

export function isAppError(error: unknown): error is AppError {
  return AppError.is(error);
}

export function serializeAppError(error: AppError): AppErrorShape {
  return {
    errorCode: error.errorCode,
    message: error.message,
    httpStatus: error.httpStatus,
    detail: error.detail,
    retryable: error.retryable,
  };
}

export function deserializeAppError(error: AppErrorShape): AppError {
  return createAppError(error);
}
