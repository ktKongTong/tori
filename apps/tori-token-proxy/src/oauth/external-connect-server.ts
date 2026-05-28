import {
  AuthorizationServer,
  JwtService,
  OAuthException,
  type GrantIdentifier,
  type OAuthAuthCode,
  type OAuthAuthCodeRepository,
  type OAuthClient as LibraryOAuthClient,
  type OAuthClientRepository,
  type OAuthScope,
  type OAuthScopeRepository,
  type OAuthToken,
  type OAuthTokenRepository,
  type OAuthUser,
  type OAuthUserRepository,
} from "@jmondi/oauth2-server";
import { OAuthRequest } from "@jmondi/oauth2-server";
import type { Repository } from "../repository/types.ts";
import type { Connection, OAuthClient } from "../types.ts";

export interface ExternalConnectExchangeResult {
  response: {
    access_token: string;
    token_type: "Bearer";
    scope: string;
    provider: string;
    provider_uid: string;
    display_name: string;
    connection: {
      id: string;
      provider: string;
      providerUid: string;
      name: string;
      permissions: string[];
    };
    account: {
      providerAccountId: string;
      providerAccountName: string;
      providerAccountAvatar: null;
    };
  };
}

function toLibraryClient(client: OAuthClient): LibraryOAuthClient {
  return {
    id: client.clientId,
    name: client.name,
    secret: client.clientSecret,
    redirectUris: client.redirectUris,
    allowedGrants: ["authorization_code"],
    scopes: client.scopes.map((name) => ({ name })),
  };
}

function toPublicClient(client: OAuthClient): LibraryOAuthClient {
  return {
    ...toLibraryClient(client),
    secret: null,
  };
}

function toOAuthError(error: unknown) {
  if (error && typeof error === "object" && "oauth" in error) {
    const oauthError = error as {
      status?: number;
      errorType?: string;
      errorDescription?: string;
      error?: string;
    };
    return {
      status: oauthError.status ?? 400,
      body: {
        error: oauthError.errorType ?? "invalid_request",
        error_description:
          oauthError.errorDescription ?? oauthError.error ?? "OAuth request is invalid",
      },
    };
  }

  return {
    status: 500,
    body: {
      error: "server_error",
      error_description: error instanceof Error ? error.message : "OAuth request failed",
    },
  };
}

class ExternalConnectClientRepository implements OAuthClientRepository {
  constructor(
    private readonly repo: Repository,
    private readonly publicClient: boolean,
  ) {}

  async getByIdentifier(clientId: string): Promise<LibraryOAuthClient> {
    const client = await this.repo.getOAuthClient(clientId);
    if (!client) throw OAuthException.invalidClient("oauth client not found");
    return this.publicClient ? toPublicClient(client) : toLibraryClient(client);
  }

  async isClientValid(
    grantType: GrantIdentifier,
    client: LibraryOAuthClient,
    clientSecret?: string,
  ): Promise<boolean> {
    if (!client.allowedGrants.includes(grantType)) return false;
    if (client.secret && client.secret !== clientSecret) return false;
    return true;
  }
}

class ExternalConnectScopeRepository implements OAuthScopeRepository {
  async getAllByIdentifiers(scopeNames: string[]): Promise<OAuthScope[]> {
    return scopeNames.map((name) => ({ name }));
  }

  async finalize(
    scopes: OAuthScope[],
    _identifier: GrantIdentifier,
    client: LibraryOAuthClient,
  ): Promise<OAuthScope[]> {
    const allowedScopes = new Set(client.scopes.map((scope) => scope.name));
    const finalizedScopes = scopes.length ? scopes : client.scopes;
    const unauthorizedScope = finalizedScopes.find((scope) => !allowedScopes.has(scope.name));
    if (unauthorizedScope) throw OAuthException.unauthorizedScope(unauthorizedScope.name);
    return finalizedScopes;
  }
}

class ExternalConnectUserRepository implements OAuthUserRepository {
  constructor(private readonly repo: Repository) {}

  async getUserByCredentials(identifier: string | number): Promise<OAuthUser | undefined> {
    const connection = await this.repo.getConnectionById(String(identifier));
    if (!connection) return undefined;
    return { id: connection.id };
  }
}

class ExternalConnectAuthCodeRepository implements OAuthAuthCodeRepository {
  constructor(private readonly repo: Repository) {}

  async getByIdentifier(code: string): Promise<OAuthAuthCode> {
    const [sid] = code.split(".");
    const session = sid ? await this.repo.getAuthSession(sid) : null;
    if (
      !session ||
      session.mode !== "external-connect" ||
      !session.externalConnect ||
      !session.externalConnect.clientId ||
      session.authCode !== code ||
      !session.externalConnect.connectionId
    ) {
      throw OAuthException.invalidGrant("invalid or expired authorization code");
    }

    const client = await this.repo.getOAuthClient(session.externalConnect.clientId);
    if (!client) throw OAuthException.invalidClient("oauth client not found");

    return {
      code,
      redirectUri: session.externalConnect.redirectUri,
      codeChallenge: session.externalConnect.codeChallenge,
      codeChallengeMethod: session.externalConnect.codeChallengeMethod,
      expiresAt: new Date(session.expiresAt),
      user: { id: session.externalConnect.connectionId },
      client: toLibraryClient(client),
      scopes: (session.requestedConnection?.permissions ?? client.scopes).map((name) => ({
        name,
      })),
    };
  }

  issueAuthCode(): OAuthAuthCode {
    throw OAuthException.internalServerError("external-connect issues auth codes in admin flow");
  }

  async persist(): Promise<void> {}

  async isRevoked(code: string): Promise<boolean> {
    const [sid] = code.split(".");
    if (!sid) return true;
    const session = await this.repo.getAuthSession(sid);
    if (!session?.authCode || session.authCode !== code) return true;
    return session.expiresAt < Date.now();
  }

  async revoke(code: string): Promise<void> {
    const connectionId = await this.repo.consumeAuthCode(code);
    if (!connectionId) throw OAuthException.invalidGrant("invalid or expired authorization code");

    const [sid] = code.split(".");
    if (sid) await this.repo.deleteAuthSession(sid);
  }
}

class ExternalConnectTokenRepository implements OAuthTokenRepository {
  private tokens = new Map<string, OAuthToken>();

  constructor(private readonly repo: Repository) {}

  async issueToken(
    client: LibraryOAuthClient,
    scopes: OAuthScope[],
    user?: OAuthUser | null,
  ): Promise<OAuthToken> {
    if (!user) throw OAuthException.invalidGrant("authorization code has no bound connection");

    const connection = await this.repo.getConnectionById(String(user.id));
    if (!connection) throw OAuthException.invalidGrant("connection not found");

    return {
      accessToken: connection.apiKey,
      accessTokenExpiresAt: new Date(Date.now() + 3600_000),
      refreshToken: null,
      refreshTokenExpiresAt: null,
      client,
      user,
      scopes,
      connection,
    } as OAuthToken & { connection: Connection };
  }

  async issueRefreshToken(accessToken: OAuthToken): Promise<OAuthToken> {
    return { ...accessToken, refreshToken: null, refreshTokenExpiresAt: null };
  }

  async persist(accessToken: OAuthToken): Promise<void> {
    this.tokens.set(accessToken.accessToken, accessToken);
  }

  async revoke(accessToken: OAuthToken): Promise<void> {
    this.tokens.delete(accessToken.accessToken);
  }

  async isRefreshTokenRevoked(): Promise<boolean> {
    return true;
  }

  async getByRefreshToken(): Promise<OAuthToken> {
    throw OAuthException.invalidGrant("refresh tokens are not issued for external-connect");
  }

  async getByAccessToken(accessToken: string): Promise<OAuthToken> {
    const token = this.tokens.get(accessToken);
    if (!token) throw OAuthException.invalidGrant("access token not found");
    return token;
  }
}

export function createExternalConnectOAuthServer(repo: Repository, secret: string) {
  const clientRepository = new ExternalConnectClientRepository(repo, false);
  const tokenRepository = new ExternalConnectTokenRepository(repo);
  const scopeRepository = new ExternalConnectScopeRepository();
  const userRepository = new ExternalConnectUserRepository(repo);
  const authCodeRepository = new ExternalConnectAuthCodeRepository(repo);

  const server = new AuthorizationServer(
    clientRepository,
    tokenRepository,
    scopeRepository,
    secret,
    {
      requiresPKCE: true,
      requiresS256: true,
      useOpaqueAuthorizationCodes: true,
    },
  );
  server.enableGrantType({
    grant: "authorization_code",
    authCodeRepository,
    userRepository,
  });

  return { server, tokenRepository };
}

export async function validateExternalConnectAuthorizationRequest(
  repo: Repository,
  request: {
    client_id: string;
    redirect_uri: string;
    response_type: "code";
    state: string;
    code_challenge: string;
    code_challenge_method: "S256";
    scope?: string;
  },
) {
  const server = new AuthorizationServer(
    new ExternalConnectClientRepository(repo, true),
    new ExternalConnectTokenRepository(repo),
    new ExternalConnectScopeRepository(),
    "external-connect-authorization-validation",
    {
      requiresPKCE: true,
      requiresS256: true,
      useOpaqueAuthorizationCodes: true,
    },
  );
  server.enableGrantType({
    grant: "authorization_code",
    authCodeRepository: new ExternalConnectAuthCodeRepository(repo),
    userRepository: new ExternalConnectUserRepository(repo),
  });

  await server.validateAuthorizationRequest(
    new OAuthRequest({
      query: {
        client_id: request.client_id,
        redirect_uri: request.redirect_uri,
        response_type: request.response_type,
        state: request.state,
        code_challenge: request.code_challenge,
        code_challenge_method: request.code_challenge_method,
        ...(request.scope ? { scope: request.scope } : {}),
      },
    }),
  );
}

export async function exchangeExternalConnectAuthorizationCode(
  repo: Repository,
  secret: string,
  request: {
    code: string;
    client_id?: string;
    client_secret?: string;
    redirect_uri?: string;
    code_verifier?: string;
  },
): Promise<ExternalConnectExchangeResult> {
  const { server, tokenRepository } = createExternalConnectOAuthServer(repo, secret);

  try {
    const oauthResponse = await server.respondToAccessTokenRequest(
      new OAuthRequest({
        body: {
          grant_type: "authorization_code",
          code: request.code,
          client_id: request.client_id,
          client_secret: request.client_secret,
          redirect_uri: request.redirect_uri,
          code_verifier: request.code_verifier,
        },
      }),
    );
    const body = oauthResponse.body as { access_token?: string; scope?: string };
    const accessToken = body.access_token;
    if (!accessToken) throw OAuthException.internalServerError("missing access token");

    let conn: Connection | null = null;
    try {
      const token = (await tokenRepository.getByAccessToken(accessToken)) as OAuthToken & {
        connection?: Connection;
      };
      conn = token.connection ?? null;
    } catch {
      const payload = await new JwtService(secret).verify(accessToken);
      const apiKey = typeof payload.jti === "string" ? payload.jti : null;
      conn = apiKey ? await repo.getConnectionByApiKey(apiKey) : null;
    }
    if (!conn) throw OAuthException.invalidGrant("connection not found");

    return {
      response: {
        access_token: conn.apiKey,
        token_type: "Bearer",
        scope: body.scope ?? conn.permissions?.join(" ") ?? conn.provider,
        provider: conn.provider,
        provider_uid: conn.providerUid,
        display_name: conn.displayName,
        connection: {
          id: conn.id,
          provider: conn.provider,
          providerUid: conn.providerUid,
          name: conn.displayName,
          permissions: conn.permissions ?? [],
        },
        account: {
          providerAccountId: conn.providerUid,
          providerAccountName: conn.displayName,
          providerAccountAvatar: null,
        },
      },
    };
  } catch (error) {
    const oauthError = toOAuthError(error);
    throw Object.assign(new Error(oauthError.body.error_description), oauthError);
  }
}

export function externalConnectOAuthError(error: unknown) {
  if (error && typeof error === "object" && "status" in error && "body" in error) {
    return error as { status: number; body: { error: string; error_description: string } };
  }
  return toOAuthError(error);
}
