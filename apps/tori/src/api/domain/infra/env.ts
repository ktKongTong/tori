import { z } from "zod";

export const backendEnvSchema = z.object({
  ENVIRONMENT: z.string(),
  LOCAL_DEV_HOST: z.string().optional(),
  DB_URL: z.string().optional(),
  DATABASE_URL: z.string().optional(),

  GITHUB_CLIENT_ID: z.string().optional(),
  GITHUB_CLIENT_SECRET: z.string().optional(),
  GOOGLE_CLIENT_ID: z.string().optional(),
  GOOGLE_CLIENT_SECRET: z.string().optional(),

  BETTER_AUTH_TRUSTED_ORIGIN: z.string().optional(),
  BETTER_AUTH_SECRET: z.string(),
  AUTHZ_ENABLED: z.string().optional(),
  RESEND_TOKEN: z.string(),
  ADMIN_EMAIL: z.string(),
  ADMIN_NAME: z.string(),

  CREDENTIAL_SECRET: z.string(),
  S3_ACCESS_KEY_ID: z.string().optional(),
  S3_SECRET_ACCESS_KEY: z.string().optional(),
  S3_ENDPOINT: z.string().optional(),
  S3_BUCKET: z.string().optional(),
  S3_REGION: z.string().optional(),
  S3_PUBLIC_DOMAIN: z.string().optional(),
  STEAM_WEB_API_KEY: z.string().optional(),
});

export type ENV = z.output<typeof backendEnvSchema>;
