import { hasRole } from "@repo/auth/access-control";
import { createAuth } from "@repo/auth/server";
import * as pgSchema from "@/api/db/schema/pg/index.ts";
import * as sqliteSchema from "@/api/db/schema/d1/index.ts";
import type { DBOptions } from "@/api/db/index";
import type { Auth } from "@/api/domain/infra/auth.ts";
import type { ENV } from "@/api/domain/infra/env.ts";
import { getTrustedOriginPattern } from "@/api/support/auth/base-url.ts";

export const getTrustedOrigins = (env: ENV) => {
  const res = getTrustedOriginPattern(env.BETTER_AUTH_TRUSTED_ORIGIN);
  if (env.ENVIRONMENT === "development" && env.LOCAL_DEV_HOST) {
    res.push(env.LOCAL_DEV_HOST);
  }
  return res;
};

const getIns = (dbOpt: DBOptions, env: ENV) => {
  const schema = dbOpt.provider === "sqlite" ? sqliteSchema : pgSchema;

  return createAuth({
    basePath: "/api/auth",
    drizzle: {
      db: dbOpt.db,
      provider: dbOpt.provider,
      schema: schema as Record<string, unknown>,
      debugLogs: false,
    },
    trustedOrigins: getTrustedOrigins(env),
    emailAndPassword: {
      enabled: true,
    },
    socialProviders: {
      github: {
        clientId: env.GITHUB_CLIENT_ID!,
        clientSecret: env.GITHUB_CLIENT_SECRET!,
      },
      google: {
        clientId: env.GOOGLE_CLIENT_ID!,
        clientSecret: env.GOOGLE_CLIENT_SECRET!,
      },
    },
  });
};

export const checkUserHasRole = (userRole: string, check: string) => {
  return hasRole(userRole, check);
};

export const getAuth = (dbOpt: DBOptions, env: ENV) => {
  return getIns(dbOpt, env) as unknown as Auth;
};
