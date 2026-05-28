import { FetchError, ofetch } from "ofetch";
import { z } from "zod";

export class TokenProxyWebError extends Error {
  constructor(
    message: string,
    public status?: number,
    public payload?: unknown,
  ) {
    super(message);
  }
}

const client = ofetch.create({
  credentials: "include",
  retry: 0,
  timeout: 15_000,
  headers: {
    accept: "application/json",
  },
});

function normalizeError(error: unknown): TokenProxyWebError {
  if (error instanceof TokenProxyWebError) return error;
  if (error instanceof FetchError) {
    const payload = error.data;
    const message =
      typeof payload === "object" && payload && "error_description" in payload
        ? String((payload as { error_description: unknown }).error_description)
        : error.message;
    return new TokenProxyWebError(message, error.response?.status, payload);
  }
  if (error instanceof z.ZodError) {
    return new TokenProxyWebError(error.issues.map((issue) => issue.message).join("; "));
  }
  if (error instanceof Error) return new TokenProxyWebError(error.message);
  return new TokenProxyWebError("Unknown token-proxy web error");
}

export async function apiRequest<T>(path: string, init?: RequestInit): Promise<T> {
  const headers = new Headers(init?.headers);
  if (init?.body && !headers.has("content-type")) {
    headers.set("content-type", "application/json");
  }

  try {
    return await client<T>(path, {
      ...init,
      headers,
    });
  } catch (error) {
    throw normalizeError(error);
  }
}

export async function schemaRequest<TSchema extends z.ZodTypeAny>(
  path: string,
  schema: TSchema,
  init?: RequestInit,
): Promise<z.infer<TSchema>> {
  const payload = await apiRequest<unknown>(path, init);
  return schema.parse(payload);
}

export const adminSessionSchema = z.object({
  authenticated: z.boolean(),
});

export const providerInfoSchema = z.object({
  name: z.string(),
  displayName: z.string(),
  flow: z.enum(["poll", "redirect", "direct"]),
  tokenInjectMethod: z.string(),
  refreshIntervalSec: z.number().nullable(),
});

export const providersListSchema = z.object({
  items: z.array(providerInfoSchema),
});

export const connectionSchema = z.object({
  id: z.string(),
  provider: z.string(),
  providerUid: z.string(),
  displayName: z.string(),
  label: z.string().nullable().optional(),
  tokenInject: z.string(),
  permissions: z.array(z.string()).default([]),
  apiKey: z.string(),
  apiKeyPreview: z.string().optional(),
  status: z.string(),
  createdAt: z.number(),
  updatedAt: z.number().nullable().optional(),
  lastUsedAt: z.number().nullable().optional(),
});

export const connectionsListSchema = z.object({
  items: z.array(connectionSchema),
});

export const reconnectSessionSchema = z.object({
  id: z.string(),
  provider: z.string(),
  status: z.enum(["pending", "completed", "failed", "expired"]),
  verificationUri: z.string().nullable(),
  pollIntervalSeconds: z.string(),
  expiresAt: z.number(),
  providerUid: z.string().nullable(),
  displayName: z.string().nullable(),
  apiKey: z.string().nullable().optional(),
  connection: connectionSchema.nullable().optional(),
  errorMessage: z.string().nullable(),
});

export const connectSessionSchema = reconnectSessionSchema;

export const externalConnectSessionSchema = reconnectSessionSchema.extend({
  connections: z.array(connectionSchema).default([]),
});

export const externalConnectConfirmResponseSchema = z.object({
  redirectUrl: z.string().url(),
});

export const requestLogSchema = z.object({
  id: z.number(),
  connectionId: z.string(),
  routeGroup: z.string(),
  method: z.string(),
  targetUrl: z.string().nullable().optional(),
  statusCode: z.number().nullable().optional(),
  error: z.string().nullable().optional(),
  createdAt: z.number(),
});

export const requestLogsListSchema = z.object({
  items: z.array(requestLogSchema),
});

export const oauthClientCreatedSchema = z.object({
  client_id: z.string(),
  client_secret: z.string(),
  client_name: z.string(),
  redirect_uris: z.array(z.string()),
  scopes: z.array(z.string()),
});

export const tokenRefreshLogSchema = z.object({
  id: z.number(),
  taskRunId: z.string().nullable().optional(),
  connectionId: z.string(),
  provider: z.string(),
  status: z.string(),
  message: z.string().nullable().optional(),
  createdAt: z.number(),
});

export const tokenRefreshLogsListSchema = z.object({
  items: z.array(tokenRefreshLogSchema),
});

export const systemTaskDefinitionSchema = z.object({
  id: z.string(),
  kind: z.string(),
  provider: z.string(),
  enabled: z.boolean(),
  intervalSec: z.number(),
  payload: z.record(z.string(), z.unknown()),
  nextRunAt: z.number(),
  lastTriggeredAt: z.number().nullable(),
  lastRunAt: z.number().nullable(),
  lastRunStatus: z.string().nullable(),
  lastError: z.string().nullable(),
  createdAt: z.number(),
  updatedAt: z.number(),
});

export const systemTaskRunSchema = z.object({
  id: z.string(),
  taskDefinitionId: z.string(),
  kind: z.string(),
  status: z.string(),
  summary: z.record(z.string(), z.unknown()).nullable().optional(),
  errorMessage: z.string().nullable().optional(),
  scheduledFor: z.number().nullable().optional(),
  startedAt: z.number().nullable().optional(),
  finishedAt: z.number().nullable().optional(),
  createdAt: z.number(),
});

export const systemTaskDefinitionsListSchema = z.object({
  items: z.array(systemTaskDefinitionSchema),
});

export const systemTaskRunsListSchema = z.object({
  items: z.array(systemTaskRunSchema),
});
