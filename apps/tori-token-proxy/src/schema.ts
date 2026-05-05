import { z } from "zod";

// ─── OAuth ───

export const deviceAuthorizeSchema = z.object({
  provider: z.string().min(1, "provider is required"),
  scope: z.string().optional(),
});

export const tokenRequestSchema = z.object({
  grant_type: z.string().min(1, "grant_type is required"),
  device_code: z.string().optional(),
  code: z.string().optional(),
});

export const revokeSchema = z.object({
  token: z.string().min(1, "token is required"),
});

export const introspectSchema = z.object({
  token: z.string().min(1, "token is required"),
});

// ─── Proxy ───

export const proxyHeadersSchema = z.object({
  "x-api-key": z.string().min(1, "X-API-KEY is required"),
  "x-proxy-url": z.string().url("X-PROXY-URL must be a valid URL"),
});
