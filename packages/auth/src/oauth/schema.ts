import { z } from "zod";

export const deviceAuthorizeSchema = z.object({
  provider: z.string().min(1, "provider is required"),
  scope: z.string().optional(),
});

export type DeviceAuthorizeInput = z.output<typeof deviceAuthorizeSchema>;

export const oauthTokenRequestSchema = z.object({
  grant_type: z.string().min(1, "grant_type is required"),
  device_code: z.string().optional(),
  code: z.string().optional(),
});

export type OAuthTokenRequest = z.output<typeof oauthTokenRequestSchema>;

export const oauthTokenOperationSchema = z.object({
  token: z.string().min(1, "token is required"),
});

export type OAuthTokenOperation = z.output<typeof oauthTokenOperationSchema>;

export const oauthProxyHeadersSchema = z.object({
  "x-api-key": z.string().min(1, "X-API-KEY is required"),
  "x-proxy-url": z.url("X-PROXY-URL must be a valid URL"),
});

export type OAuthProxyHeaders = z.output<typeof oauthProxyHeadersSchema>;
