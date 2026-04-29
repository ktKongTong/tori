import { createAppError, type AppError } from "@repo/core/errors/base";
import { ErrorCode, type ErrorCodeValue } from "@repo/core/errors/error-codes";

export type DatabaseCause = {
  code?: string;
};

const DATABASE_ERROR_MAP: Record<
  string,
  { errorCode: ErrorCodeValue; message: string; httpStatus: number }
> = {
  "23505": {
    errorCode: ErrorCode.DB_UNIQUE_VIOLATION,
    message: "Record already exists (duplicate value)",
    httpStatus: 409,
  },
  "23503": {
    errorCode: ErrorCode.DB_FOREIGN_KEY,
    message: "Referenced record not found or still in use",
    httpStatus: 409,
  },
};

export function isDatabaseCause(value: unknown): value is DatabaseCause {
  return typeof value === "object" && value !== null && "code" in value;
}

export function DatabaseError(
  errorCode: ErrorCodeValue,
  message: string,
  httpStatus = 409,
): AppError {
  return createAppError({ errorCode, message, httpStatus });
}

export function toDatabaseError(cause: DatabaseCause | undefined): AppError {
  const mapped = cause?.code ? DATABASE_ERROR_MAP[cause.code] : undefined;
  if (mapped) {
    return DatabaseError(mapped.errorCode, mapped.message, mapped.httpStatus);
  }
  return DatabaseError(ErrorCode.DB_ERROR, "A database error occurred", 500);
}
