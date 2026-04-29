import { createAppError, type AppError, type SerializableErrorDetail } from "./base.ts";
import { ErrorCode } from "./error-codes.ts";

export type ValidationIssue = {
  message: string;
  path?: PropertyKey[];
  code?: string;
};

function serializeIssue(issue: ValidationIssue): SerializableErrorDetail {
  return {
    message: issue.message,
    path: issue.path?.map(String),
    code: issue.code,
  };
}

export function ValidationError(
  issues: ValidationIssue[],
  message = "Validation failed",
): AppError {
  return createAppError({
    errorCode: ErrorCode.VALIDATION_FAILED,
    httpStatus: 400,
    message,
    detail: issues.map(serializeIssue),
  });
}
