import { createAppAuthClient } from "@repo/auth/client/react";

export const authClient = createAppAuthClient();

export const { signIn, signUp, signOut, useSession } = authClient;
