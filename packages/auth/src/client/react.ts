import { createAuthClient } from "better-auth/react";

export type CreateAuthClientOptions = Parameters<typeof createAuthClient>[0];
export type AppAuthClient = ReturnType<typeof createAuthClient>;

export function createAppAuthClient(options?: CreateAuthClientOptions): AppAuthClient {
  return createAuthClient(options);
}

export type AuthClient = AppAuthClient;
export type ClientSession = AuthClient["$Infer"]["Session"];
