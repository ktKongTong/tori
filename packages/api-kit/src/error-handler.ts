import { isAppError, type AppError } from "@repo/core/errors/base";
import { ErrorCode } from "@repo/core/errors/error-codes";
import { ValidationError } from "@repo/core/errors/validation";
import { errorEnvelope } from "@repo/protocol/http/envelope";
import { isJsonObject, isJsonValue } from "@repo/protocol/json";
import type { ErrorHandler } from "hono";
import { HTTPException } from "hono/http-exception";
import type { ContentfulStatusCode } from "hono/utils/http-status";
import { ZodError } from "zod";

export type ErrorResponse = {
  traceId?: string;
  code: string;
  message: string;
  detail?: unknown;
};

export type ErrorLogger = {
  debug?: (error: unknown) => void;
  error?: (error: unknown) => void;
};

export type ErrorHandlerOptions = {
  getTraceId?: (context: Parameters<ErrorHandler>[1]) => string | undefined;
  logger?: ErrorLogger;
  exposeUnexpectedErrors?: boolean;
  normalizeError?: (error: unknown) => unknown;
};

type BetterAuthLikeError = Error & {
  statusCode: number;
  body?: unknown;
};

type ErrorHttpShape = {
  errorCode: string;
  httpStatus: number;
  message: string;
  detail?: unknown;
};

function toStatusCode(status: number): ContentfulStatusCode {
  return status as ContentfulStatusCode;
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null;
}

function getStringField(record: Record<string, unknown>, key: string): string | undefined {
  const value = record[key];
  return typeof value === "string" ? value : undefined;
}

function isBetterAuthLikeError(error: unknown): error is BetterAuthLikeError {
  return (
    error instanceof Error &&
    "statusCode" in error &&
    typeof (error as { statusCode?: unknown }).statusCode === "number"
  );
}

function isErrorHttpShape(error: unknown): error is ErrorHttpShape {
  return (
    isRecord(error) &&
    typeof error.errorCode === "string" &&
    typeof error.httpStatus === "number" &&
    typeof error.message === "string"
  );
}

function logError(logger: ErrorLogger | undefined, error: unknown, status: number) {
  if (status >= 500) {
    logger?.error?.(error);
    return;
  }
  logger?.debug?.(error);
}

function unwrapErrorEnvelope(response: { error: ErrorResponse }): ErrorResponse {
  return response.error;
}

function appErrorResponse(error: AppError, traceId: string | undefined): ErrorResponse {
  return unwrapErrorEnvelope(
    errorEnvelope(error.errorCode, error.message, {
      traceId,
      detail: isJsonObject(error.detail) ? error.detail : undefined,
    }),
  );
}

function httpShapeErrorResponse(error: ErrorHttpShape, traceId: string | undefined): ErrorResponse {
  return stripUndefined({
    code: error.errorCode,
    message: error.message,
    traceId,
    detail: isJsonValue(error.detail) ? error.detail : undefined,
  });
}

function stripUndefined<T extends Record<string, unknown>>(value: T): T {
  for (const key of Object.keys(value)) {
    if (value[key] === undefined) delete value[key];
  }
  return value;
}

export function createErrorHandler(options: ErrorHandlerOptions = {}): ErrorHandler {
  return (error, context) => {
    const normalizedError = options.normalizeError?.(error) ?? error;
    const traceId = options.getTraceId?.(context) ?? context.get("requestId");

    if (isAppError(normalizedError)) {
      logError(options.logger, normalizedError, normalizedError.httpStatus);
      return context.json(
        stripUndefined(appErrorResponse(normalizedError, traceId)),
        toStatusCode(normalizedError.httpStatus),
      );
    }

    if (isErrorHttpShape(normalizedError)) {
      logError(options.logger, normalizedError, normalizedError.httpStatus);
      return context.json(
        httpShapeErrorResponse(normalizedError, traceId),
        toStatusCode(normalizedError.httpStatus),
      );
    }

    if (normalizedError instanceof ZodError) {
      const validationError = ValidationError(normalizedError.issues);
      logError(options.logger, normalizedError, validationError.httpStatus);
      return context.json(stripUndefined(appErrorResponse(validationError, traceId)), 400);
    }

    if (normalizedError instanceof HTTPException) {
      logError(options.logger, normalizedError, normalizedError.status);
      return context.json(
        unwrapErrorEnvelope(errorEnvelope(ErrorCode.UNKNOWN, normalizedError.message, { traceId })),
        toStatusCode(normalizedError.status),
      );
    }

    if (isBetterAuthLikeError(normalizedError)) {
      logError(options.logger, normalizedError, normalizedError.statusCode);
      const rawBody = isRecord(normalizedError.body) ? normalizedError.body : {};
      return context.json(
        unwrapErrorEnvelope(
          errorEnvelope(
            getStringField(rawBody, "code") ?? ErrorCode.UNKNOWN,
            getStringField(rawBody, "message") ?? normalizedError.message,
            {
              traceId,
              detail: isJsonValue(rawBody.detail) ? { value: rawBody.detail } : undefined,
            },
          ),
        ),
        toStatusCode(normalizedError.statusCode),
      );
    }

    logError(options.logger, normalizedError, 500);
    return context.json(
      unwrapErrorEnvelope(
        errorEnvelope(
          ErrorCode.UNKNOWN,
          options.exposeUnexpectedErrors && normalizedError instanceof Error
            ? normalizedError.message
            : "An unexpected error occurred",
          { traceId },
        ),
      ),
      500,
    );
  };
}

export const errorHandler = createErrorHandler();
