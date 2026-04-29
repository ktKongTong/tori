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
};

type BetterAuthLikeError = Error & {
  statusCode: number;
  body?: unknown;
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

function stripUndefined<T extends Record<string, unknown>>(value: T): T {
  for (const key of Object.keys(value)) {
    if (value[key] === undefined) delete value[key];
  }
  return value;
}

export function createErrorHandler(options: ErrorHandlerOptions = {}): ErrorHandler {
  return (error, context) => {
    const traceId = options.getTraceId?.(context) ?? context.get("requestId");

    if (isAppError(error)) {
      logError(options.logger, error, error.httpStatus);
      return context.json(
        stripUndefined(appErrorResponse(error, traceId)),
        toStatusCode(error.httpStatus),
      );
    }

    if (error instanceof ZodError) {
      const validationError = ValidationError(error.issues);
      logError(options.logger, error, validationError.httpStatus);
      return context.json(stripUndefined(appErrorResponse(validationError, traceId)), 400);
    }

    if (error instanceof HTTPException) {
      logError(options.logger, error, error.status);
      return context.json(
        unwrapErrorEnvelope(errorEnvelope(ErrorCode.UNKNOWN, error.message, { traceId })),
        toStatusCode(error.status),
      );
    }

    if (isBetterAuthLikeError(error)) {
      logError(options.logger, error, error.statusCode);
      const rawBody = isRecord(error.body) ? error.body : {};
      return context.json(
        unwrapErrorEnvelope(
          errorEnvelope(
            getStringField(rawBody, "code") ?? ErrorCode.UNKNOWN,
            getStringField(rawBody, "message") ?? error.message,
            {
              traceId,
              detail: isJsonValue(rawBody.detail) ? { value: rawBody.detail } : undefined,
            },
          ),
        ),
        toStatusCode(error.statusCode),
      );
    }

    logError(options.logger, error, 500);
    return context.json(
      unwrapErrorEnvelope(
        errorEnvelope(
          ErrorCode.UNKNOWN,
          options.exposeUnexpectedErrors && error instanceof Error
            ? error.message
            : "An unexpected error occurred",
          { traceId },
        ),
      ),
      500,
    );
  };
}

export const errorHandler = createErrorHandler();
