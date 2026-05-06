import { createErrorHandler } from "@repo/api-kit";
import { pinoLogger } from "@repo/observability/logging";
import { isDrizzleError, toDatabaseError, ZodValidatorError } from "@/api/domain/error";

const normalizeApiError = (error: unknown) => {
  if (isDrizzleError(error)) return toDatabaseError(error);
  if (error instanceof ZodValidatorError) {
    error.detail = error.issues;
  }
  return error;
};

export const errorHandler = createErrorHandler({
  logger: pinoLogger,
  normalizeError: normalizeApiError,
});
