import type { JsonObject, JsonValue } from "./json.ts";

export type ErrorEnvelope<TCode extends string = string, TDetail extends JsonValue = JsonValue> = {
  code: TCode;
  message: string;
  traceId?: string;
  detail?: TDetail;
};

export type DataEnvelope<TData> = {
  data: TData;
};

export type ResultEnvelope<
  TData,
  TCode extends string = string,
  TDetail extends JsonValue = JsonValue,
> = DataEnvelope<TData> | { error: ErrorEnvelope<TCode, TDetail> };

export type OAuthErrorEnvelope<TError extends string = string> = {
  error: TError;
  error_description?: string;
  error_uri?: string;
};

export function dataEnvelope<TData>(data: TData): DataEnvelope<TData> {
  return { data };
}

export function errorEnvelope<TCode extends string>(
  code: TCode,
  message: string,
  options: { traceId?: string; detail?: JsonObject } = {},
): { error: ErrorEnvelope<TCode, JsonObject> } {
  const error: ErrorEnvelope<TCode, JsonObject> = { code, message };
  if (options.traceId !== undefined) error.traceId = options.traceId;
  if (options.detail !== undefined) error.detail = options.detail;
  return {
    error,
  };
}

export function oauthErrorEnvelope<TError extends string>(
  error: TError,
  description?: string,
): OAuthErrorEnvelope<TError> {
  const envelope: OAuthErrorEnvelope<TError> = { error };
  if (description !== undefined) envelope.error_description = description;
  return envelope;
}
