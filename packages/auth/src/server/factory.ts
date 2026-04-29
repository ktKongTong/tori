import { betterAuth } from "better-auth";
import { drizzleAdapter } from "better-auth/adapters/drizzle";
import type { BetterAuthOptions } from "better-auth/types";
import { baseAuthConfig } from "./config.ts";

export type AuthDatabaseProvider = "pg" | "sqlite" | "mysql";

export type SocialProviderCredentials = {
  clientId: string;
  clientSecret: string;
};

export type AuthSocialProviders = {
  github?: SocialProviderCredentials;
  google?: SocialProviderCredentials;
};

export type CreateDrizzleAuthOptions = {
  db: unknown;
  provider: AuthDatabaseProvider;
  schema?: Record<string, unknown>;
  debugLogs?: boolean;
};

export type CreateAuthOptionsInput = {
  basePath?: string;
  database?: BetterAuthOptions["database"];
  drizzle?: CreateDrizzleAuthOptions;
  trustedOrigins?: string[];
  emailAndPassword?: BetterAuthOptions["emailAndPassword"];
  socialProviders?: AuthSocialProviders;
  overrides?: Partial<BetterAuthOptions>;
};

export function createAuthOptions(input: CreateAuthOptionsInput): BetterAuthOptions {
  const database = input.database ?? createDrizzleDatabase(input.drizzle);

  return {
    ...baseAuthConfig,
    ...input.overrides,
    basePath: input.basePath ?? input.overrides?.basePath,
    database,
    trustedOrigins: input.trustedOrigins ?? input.overrides?.trustedOrigins ?? [],
    emailAndPassword: input.emailAndPassword ?? input.overrides?.emailAndPassword,
    socialProviders: input.socialProviders ?? input.overrides?.socialProviders,
  } satisfies BetterAuthOptions;
}

export function createAuth(input: CreateAuthOptionsInput) {
  return betterAuth(createAuthOptions(input));
}

function createDrizzleDatabase(drizzle: CreateDrizzleAuthOptions | undefined) {
  if (!drizzle) return undefined;
  return drizzleAdapter(drizzle.db as never, {
    provider: drizzle.provider,
    schema: drizzle.schema,
    debugLogs: drizzle.debugLogs ?? false,
  });
}

export type Auth = ReturnType<typeof createAuth>;
export type User = Auth["$Infer"]["Session"]["user"];
export type Session = Auth["$Infer"]["Session"]["session"];
