import { NotFoundError, ParameterError, StatusConflictError } from "@/api/domain/error/index.ts";
import type { ServiceContext } from "@/api/domain/infra/service-context.ts";
import { uniqueId } from "@repo/utils/id";
import { randomCode } from "@repo/utils/random";
import { ofetch } from "ofetch";
import { z } from "zod";
import type { CreateConnectionInput } from "./type.ts";
import type { StartTokenProxyConnectionDto, UpdateConnectionStatusDto } from "./contract.ts";
import { getSteamAccountRepository } from "@/api/modules/steam/core/account/repository";
import { getSteamFamilyRepository } from "@/api/modules/steam/core/family/repository";
import {
  CONNECTION_DELETED,
  CONNECTION_DISABLED,
  createConnectionLifecycleEvent,
} from "@/api/modules/platform/integration/connection/event.ts";

const TOKEN_PROXY_CREDENTIAL_KIND = "token-proxy-api-key";

const tokenProxyExchangeResponseSchema = z.object({
  connection: z.object({
    id: z.string(),
    provider: z.string(),
    providerUid: z.string(),
    name: z.string().nullish(),
    permissions: z.array(z.string()).default([]),
  }),
  access_token: z.string().min(1),
  token_type: z.string(),
  scope: z.string(),
  provider: z.string(),
  provider_uid: z.string(),
  display_name: z.string(),
  account: z
    .object({
      providerAccountId: z.string(),
      providerAccountName: z.string().nullable().optional(),
      providerAccountAvatar: z.string().nullable().optional(),
    })
    .optional(),
});

type TokenProxyCallbackRenderResult =
  | { status: "completed"; state: string; connection: ConnectionCallbackPayload }
  | { status: "failed"; state: string; error: string }
  | { status: string; state: string; error?: string | null; connectionId?: string | null };

type ConnectionCallbackPayload = {
  id: string;
  ownerUserId: string;
  proxyInstanceId: string | null;
  provider: string;
  providerAccountId: string;
  providerAccountName: string | null;
  providerAccountAvatar: string | null;
  accessMode: string;
  status: string;
  isDefault: boolean;
  metadata: unknown;
  connectedAt: Date;
  lastSyncedAt: Date | null;
  createdAt: Date;
  updatedAt: Date;
};

function base64UrlEncode(bytes: Uint8Array) {
  let binary = "";
  for (const byte of bytes) binary += String.fromCharCode(byte);
  return btoa(binary).replaceAll("+", "-").replaceAll("/", "_").replaceAll("=", "");
}

async function createCodeChallenge(verifier: string) {
  const digest = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(verifier));
  return base64UrlEncode(new Uint8Array(digest));
}

function readOAuthClient(metadata: unknown) {
  if (!metadata || typeof metadata !== "object") return null;
  const oauthClient = (metadata as { oauthClient?: unknown }).oauthClient;
  if (!oauthClient || typeof oauthClient !== "object") return null;
  const clientId = (oauthClient as { clientId?: unknown }).clientId;
  const clientSecret = (oauthClient as { clientSecret?: unknown }).clientSecret;
  if (typeof clientId !== "string" || typeof clientSecret !== "string") return null;
  return { clientId, clientSecret };
}

function readCodeVerifier(metadata: unknown) {
  if (!metadata || typeof metadata !== "object") return null;
  const verifier = (metadata as { codeVerifier?: unknown }).codeVerifier;
  return typeof verifier === "string" ? verifier : null;
}

export async function createConnection(ctx: ServiceContext, input: CreateConnectionInput) {
  const userId = ctx.userId;
  if (!userId) throw new NotFoundError("user not found");

  const existing = await ctx.repositories.connection.findConnectionByOwnerAndProviderAccount({
    ownerUserId: userId,
    provider: input.provider,
    providerAccountId: input.providerAccountId,
  });

  if (existing) throw new StatusConflictError("connection already exist");

  if (input.accessMode !== "public-id" && !input.proxyInstanceId) {
    throw new ParameterError("proxy-backed connection requires proxyInstanceId");
  }
  if (input.proxyInstanceId) {
    const proxyInstance = await ctx.repositories.integration.findVisibleProxyInstance({
      id: input.proxyInstanceId,
      ownerUserId: userId,
      includeAll: ctx.isAdmin(),
    });
    if (!proxyInstance) throw new NotFoundError("proxy instance not found");
    if (proxyInstance.status !== "active") throw new ParameterError("proxy instance is not active");
    if (!proxySupportsProvider(proxyInstance.capabilities, input.provider)) {
      throw new ParameterError("proxy instance does not support provider");
    }
  }

  const row = await ctx.repositories.connection.createConnection({
    id: uniqueId(),
    ownerUserId: userId,
    ...input,
  });

  return row;
}

export async function resolveConnectionAccess(ctx: ServiceContext, connectionId: string) {
  const connection = await ctx.repositories.connection.findConnectionById(connectionId);
  if (!connection) throw new NotFoundError("connection not found");
  if (!ctx.isAdmin() && connection.ownerUserId !== ctx.userId) {
    throw new NotFoundError("connection not found");
  }

  return {
    connection,
    requiresProxy: connection.accessMode !== "public-id",
    supportsPublicAccess: connection.accessMode !== "proxy-token",
    proxyInstanceId: connection.proxyInstanceId ?? null,
  };
}

export async function updateConnectionStatus(
  ctx: ServiceContext,
  connectionId: string,
  input: UpdateConnectionStatusDto,
) {
  const userId = ctx.userId;
  if (!userId) throw new NotFoundError("user not found");

  const connection = await ctx.repositories.connection.updateConnectionStatus({
    id: connectionId,
    ownerUserId: userId,
    status: input.status,
  });
  if (!connection) throw new NotFoundError("connection not found");

  if (input.status === "disabled") {
    await ctx.repositories.connection.disableActiveConnectionCredentialsByConnectionId(
      connection.id,
    );
    await ctx.sendEvent(createConnectionLifecycleEvent(ctx, CONNECTION_DISABLED, connection.id));
  }

  return {
    id: connection.id,
    status: connection.status,
  };
}

export async function deleteConnection(ctx: ServiceContext, connectionId: string) {
  const userId = ctx.userId;
  if (!userId) throw new NotFoundError("user not found");

  const connection = await ctx.repositories.connection.findConnectionById(connectionId);
  if (!connection || connection.ownerUserId !== userId) {
    throw new NotFoundError("connection not found");
  }

  await ctx.repositories.connection.deleteConnectionCredentialsByConnectionId(connection.id);
  await ctx.repositories.connection.deleteTokenProxyConnectionSessionsByConnectionId(connection.id);
  await getSteamAccountRepository(ctx).deleteAccountDataByConnectionId(connection.id);
  await getSteamFamilyRepository(ctx).deleteFamilyDataByOwnerConnectionId(connection.id);

  const deleted = await ctx.repositories.connection.deleteConnection({
    id: connection.id,
    ownerUserId: userId,
  });
  if (!deleted) throw new NotFoundError("connection not found");

  await ctx.sendEvent(createConnectionLifecycleEvent(ctx, CONNECTION_DELETED, deleted.id));

  return {
    id: deleted.id,
    status: "deleted",
  };
}

function proxySupportsProvider(capabilities: unknown, provider: string) {
  if (!capabilities || typeof capabilities !== "object") return true;
  const providers = (capabilities as { providers?: unknown }).providers;
  if (!Array.isArray(providers)) return true;
  return providers.some(
    (item) => item && typeof item === "object" && (item as { name?: unknown }).name === provider,
  );
}

function createCallbackUrl(origin: string, sessionId: string, state: string) {
  const callbackUrl = new URL("/api/integration/connections/token-proxy/callback", origin);
  callbackUrl.searchParams.set("sessionId", sessionId);
  callbackUrl.searchParams.set("state", state);
  return callbackUrl;
}

export async function startTokenProxyConnection(
  ctx: ServiceContext,
  proxyInstanceId: string,
  input: StartTokenProxyConnectionDto,
  origin: string,
) {
  const userId = ctx.userId;
  if (!userId) throw new NotFoundError("user not found");

  const proxyInstance = await ctx.repositories.integration.findVisibleProxyInstance({
    id: proxyInstanceId,
    ownerUserId: userId,
    includeAll: ctx.isAdmin(),
  });
  if (!proxyInstance) throw new NotFoundError("proxy instance not found");
  if (proxyInstance.status !== "active") throw new ParameterError("proxy instance is not active");
  if (!proxySupportsProvider(proxyInstance.capabilities, input.provider)) {
    throw new ParameterError("proxy instance does not support provider");
  }

  const sessionId = uniqueId();
  const state = randomCode("tp_state", 16);
  const codeVerifier = randomCode("tp_verifier", 32);
  const codeChallenge = await createCodeChallenge(codeVerifier);
  const expiresAt = new Date(Date.now() + 5 * 60 * 1000);
  const callbackUrl = createCallbackUrl(origin, sessionId, state);
  const oauthClient = readOAuthClient(proxyInstance.metadata);
  if (!oauthClient) {
    throw new ParameterError("proxy instance is missing oauth client credentials");
  }
  const connectUrl = new URL("/admin/external-connect", proxyInstance.baseUrl);
  connectUrl.searchParams.set("client_id", oauthClient.clientId);
  connectUrl.searchParams.set("redirect_uri", callbackUrl.toString());
  connectUrl.searchParams.set("response_type", "code");
  connectUrl.searchParams.set("provider", input.provider);
  connectUrl.searchParams.set("sessionId", sessionId);
  connectUrl.searchParams.set("state", state);
  connectUrl.searchParams.set("code_challenge", codeChallenge);
  connectUrl.searchParams.set("code_challenge_method", "S256");
  connectUrl.searchParams.set("label", "Tori");
  connectUrl.searchParams.set("scope", "proxy account");

  const session = await ctx.repositories.connection.createTokenProxyConnectionSession({
    id: sessionId,
    state,
    ownerUserId: userId,
    proxyInstanceId: proxyInstance.id,
    provider: input.provider,
    accessMode: input.accessMode,
    callbackUrl: callbackUrl.toString(),
    tokenProxyConnectUrl: connectUrl.toString(),
    codeVerifier,
    expiresAt,
  });

  return {
    sessionId: session.id,
    state: session.state,
    connectUrl: session.tokenProxyConnectUrl,
    expiresAt: session.expiresAt.toISOString(),
  };
}

export async function completeTokenProxyConnectionCallback(
  ctx: ServiceContext,
  input: {
    sessionId: string;
    state: string;
    code?: string;
    error?: string;
    errorDescription?: string;
  },
) {
  const userId = ctx.userId;
  if (!userId) throw new NotFoundError("user not found");

  const session = await ctx.repositories.connection.findTokenProxyConnectionSession({
    id: input.sessionId,
    state: input.state,
  });
  if (!session || session.ownerUserId !== userId) {
    throw new NotFoundError("token-proxy connection session not found");
  }

  const fail = async (message: string) => {
    await ctx.repositories.connection.failTokenProxyConnectionSession({
      id: session.id,
      state: session.state,
      error: message,
    });
    return { status: "failed" as const, state: session.state, error: message };
  };

  if (session.status !== "pending") {
    return {
      status: session.status === "completed" ? ("completed" as const) : ("failed" as const),
      state: session.state,
      error: session.error ?? null,
      connectionId: session.connectionId,
    };
  }

  if (session.expiresAt.getTime() < Date.now()) {
    return fail("token-proxy connection session expired");
  }

  if (input.error) {
    return fail(input.errorDescription ?? input.error);
  }

  if (!input.code) {
    return fail("token-proxy callback is missing exchange code");
  }

  const proxyInstance = await ctx.repositories.integration.findVisibleProxyInstance({
    id: session.proxyInstanceId,
    ownerUserId: userId,
    includeAll: ctx.isAdmin(),
  });
  if (!proxyInstance || proxyInstance.status !== "active") {
    return fail("proxy instance is not active");
  }
  const oauthClient = readOAuthClient(proxyInstance.metadata);
  const codeVerifier = readCodeVerifier(session.metadata);
  if (!oauthClient || !codeVerifier) {
    return fail("proxy instance oauth client is not configured");
  }

  const form = new URLSearchParams({
    grant_type: "authorization_code",
    code: input.code,
    client_id: oauthClient.clientId,
    client_secret: oauthClient.clientSecret,
    redirect_uri: session.callbackUrl,
    code_verifier: codeVerifier,
  });
  const result = await ofetch(`${proxyInstance.baseUrl.replace(/\/+$/, "")}/oauth/token`, {
    method: "POST",
    retry: 0,
    timeout: 15_000,
    body: form,
  });
  const exchange = tokenProxyExchangeResponseSchema.parse(result);

  if (exchange.connection.provider !== session.provider) {
    return fail("token-proxy provider does not match session");
  }

  const providerAccountId = exchange.account?.providerAccountId ?? exchange.connection.providerUid;
  const providerAccountName =
    exchange.account?.providerAccountName ?? exchange.connection.name ?? null;
  const providerAccountAvatar = exchange.account?.providerAccountAvatar ?? null;

  let connection =
    await ctx.repositories.connection.findConnectionByOwnerProviderAccountAndAccessMode({
      ownerUserId: userId,
      provider: session.provider,
      providerAccountId,
      accessMode: session.accessMode,
    });

  if (!connection) {
    connection = await ctx.repositories.connection.createConnection({
      id: uniqueId(),
      ownerUserId: userId,
      provider: session.provider,
      providerAccountId,
      providerAccountName,
      providerAccountAvatar,
      accessMode: session.accessMode,
      proxyInstanceId: proxyInstance.id,
      status: "active",
      metadata: {
        source: "token-proxy-connect",
        tokenProxyConnectionId: exchange.connection.id,
        tokenProxyProvider: exchange.connection.provider,
        tokenProxyDisplayName: exchange.connection.name,
        tokenProxyPermissions: exchange.connection.permissions,
      },
    });
  } else if (connection.proxyInstanceId !== proxyInstance.id) {
    return fail("provider account is already connected through another proxy instance");
  }

  const existingCredential = await ctx.repositories.connection.findActiveConnectionCredential({
    connectionId: connection.id,
    kind: TOKEN_PROXY_CREDENTIAL_KIND,
  });
  const credentialMetadata = {
    source: "token-proxy-connect",
    tokenProxyConnectionId: exchange.connection.id,
    tokenProxyPermissions: exchange.connection.permissions,
  };
  if (!existingCredential) {
    await ctx.repositories.connection.createConnectionCredential({
      id: uniqueId(),
      connectionId: connection.id,
      proxyInstanceId: proxyInstance.id,
      kind: TOKEN_PROXY_CREDENTIAL_KIND,
      credentialRef: exchange.access_token,
      metadata: credentialMetadata,
    });
  } else {
    await ctx.repositories.connection.updateConnectionCredential({
      id: existingCredential.id,
      proxyInstanceId: proxyInstance.id,
      credentialRef: exchange.access_token,
      metadata: credentialMetadata,
    });
  }

  await ctx.repositories.connection.completeTokenProxyConnectionSession({
    id: session.id,
    state: session.state,
    tokenProxyCode: input.code,
    connectionId: connection.id,
  });

  return {
    status: "completed" as const,
    state: session.state,
    connection,
  };
}

export function renderTokenProxyConnectionCallbackPage(result: TokenProxyCallbackRenderResult) {
  const message =
    result.status === "completed" && "connection" in result
      ? {
          type: "tori:token-proxy-connect",
          state: result.state,
          status: "completed",
          connection: result.connection,
        }
      : {
          type: "tori:token-proxy-connect",
          state: result.state,
          status: "failed",
          error:
            "error" in result
              ? (result.error ?? "token-proxy connection failed")
              : "token-proxy connection failed",
        };
  const serialized = JSON.stringify(message).replaceAll("<", "\\u003c");
  return `<!doctype html>
<html lang="en">
  <head><meta charset="utf-8" /><title>Connection completed</title></head>
  <body>
    <p>You can close this window.</p>
    <script>
      const message = ${serialized};
      window.opener?.postMessage(message, window.location.origin);
      new BroadcastChannel("tori-token-proxy-connect:" + message.state).postMessage(message);
      window.close();
    </script>
  </body>
</html>`;
}
