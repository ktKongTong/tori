import { DrizzleQueryError } from "drizzle-orm/errors";
import { BizError } from "./base.js";
import { ErrorCode, type ErrorCodeValue } from "./error-codes.js";

export class DatabaseError extends BizError {
  constructor(errorCode: ErrorCodeValue, message: string, httpStatus = 409) {
    super(errorCode, message, httpStatus);
  }
}

// ---------------------------------------------------------------------------
// PostgreSQL error code → safe user message
// ---------------------------------------------------------------------------

const PG_ERROR_MAP: Record<
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

export function isDrizzleError(
  error: unknown,
): error is DrizzleQueryError & { cause: { code?: string } } {
  return (
    error instanceof DrizzleQueryError && typeof error.cause === "object" && error.cause !== null
  );
}

export function toDatabaseError(
  err: DrizzleQueryError & { cause: { code?: string } },
): DatabaseError {
  const pgCode = err.cause.code;
  const mapped = pgCode ? PG_ERROR_MAP[pgCode] : undefined;

  if (mapped) {
    return new DatabaseError(mapped.errorCode, mapped.message, mapped.httpStatus);
  }
  return new DatabaseError(ErrorCode.DB_ERROR, "A database error occurred", 500);
}
