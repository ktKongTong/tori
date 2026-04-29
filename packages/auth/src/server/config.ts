import { apiKey } from "@better-auth/api-key";
import { passkey } from "@better-auth/passkey";
import type {} from "@simplewebauthn/server";
import { admin, openAPI } from "better-auth/plugins";
import type { BetterAuthOptions } from "better-auth/types";
import { adminRole, authAccessControl, userRole } from "../access-control.ts";

export const baseAuthConfig: BetterAuthOptions = {
  plugins: [
    openAPI(),
    passkey(),
    admin({
      ac: authAccessControl,
      roles: {
        user: userRole,
        admin: adminRole,
      },
    }),
    apiKey({
      enableSessionForAPIKeys: true,
    }),
  ],
  trustedOrigins: [] as string[],
  account: {
    accountLinking: {
      enabled: true,
      trustedProviders: ["google", "github"],
    },
  },
  advanced: {
    ipAddress: {
      ipAddressHeaders: ["x-client-ip", "x-forwarded-for", "cf-connecting-ip"],
    },
  },
  session: {
    cookieCache: {
      enabled: true,
      maxAge: 1.5 * 60 * 60,
    },
  },
};

export type BaseAuthConfig = typeof baseAuthConfig;
