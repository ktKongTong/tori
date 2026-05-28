import { zValidator } from "@hono/zod-validator";
import { Hono } from "hono";
import { randomCode } from "@repo/utils/random";
import { encrypt } from "../crypto/index.ts";
import {
  exchangeExternalConnectAuthorizationCode,
  externalConnectOAuthError,
} from "../oauth/external-connect-server.ts";
import type { ProviderRegistry } from "../provider/registry.ts";
import type { Repository } from "../repository/types.ts";
import {
  deviceAuthorizeSchema,
  introspectSchema,
  revokeSchema,
  tokenRequestSchema,
} from "../schema.ts";

interface OAuthDeps {
  repo: Repository;
  registry: ProviderRegistry;
  secret: string;
}

function generateCode(prefix: string): string {
  return randomCode(prefix, 16);
}

function oauthError(c: any, status: number, error: string, description: string) {
  return c.json({ error, error_description: description }, status);
}

function zodHook(result: any, c: any) {
  if (!result.success) {
    const first = result.error.issues[0];
    return c.json(
      {
        error: "invalid_request",
        error_description: `${first.path.join(".")}: ${first.message}`,
      },
      400,
    );
  }
}

export function oauthRoutes(deps: OAuthDeps) {
  const { repo, registry, secret } = deps;
  const app = new Hono();

  // ═══════════════════════════════════════════════
  // POST /device/authorize — RFC 8628 §3.1
  // ═══════════════════════════════════════════════
  app.post("/device/authorize", zValidator("json", deviceAuthorizeSchema, zodHook), async (c) => {
    const { provider: providerName } = c.req.valid("json");

    let provider;
    try {
      provider = registry.get(providerName);
    } catch {
      return oauthError(c, 400, "invalid_request", `unknown provider: ${providerName}`);
    }

    if (provider.flow !== "poll") {
      return oauthError(
        c,
        400,
        "invalid_request",
        `provider ${providerName} does not support device flow, use /authorize`,
      );
    }

    let result;
    try {
      result = await provider.beginAuth({});
    } catch (err: any) {
      return oauthError(c, 502, "server_error", err.message);
    }

    const deviceCode = generateCode("dc");
    const expiresIn = 300;

    await repo.setAuthSession(
      deviceCode,
      {
        providerName,
        flowType: "poll",
        challengeData: result.challengeData,
        expiresAt: Date.now() + expiresIn * 1000,
      },
      expiresIn,
    );

    return c.json({
      device_code: deviceCode,
      verification_uri: result.challengeData.qrUrl,
      expires_in: expiresIn,
      interval: result.challengeData.interval || 5,
    });
  });

  // ═══════════════════════════════════════════════
  // GET /authorize — RFC 6749 §3.1
  // ═══════════════════════════════════════════════
  app.get("/authorize", async (c) => {
    const providerName = c.req.query("provider");
    const redirectUri = c.req.query("redirect_uri");
    const state = c.req.query("state");

    if (!providerName) {
      return oauthError(c, 400, "invalid_request", "provider is required");
    }

    let provider;
    try {
      provider = registry.get(providerName);
    } catch {
      return oauthError(c, 400, "invalid_request", `unknown provider: ${providerName}`);
    }

    if (provider.flow !== "redirect") {
      return oauthError(
        c,
        400,
        "invalid_request",
        `provider ${providerName} does not support redirect flow, use /device/authorize`,
      );
    }

    let result;
    try {
      result = await provider.beginAuth({ redirect_uri: redirectUri, state });
    } catch (err: any) {
      return oauthError(c, 502, "server_error", err.message);
    }

    const authCode = generateCode("ac");
    await repo.setAuthSession(
      authCode,
      {
        providerName,
        flowType: "redirect",
        challengeData: { ...result.challengeData, redirect_uri: redirectUri, state },
        expiresAt: Date.now() + 300_000,
      },
      300,
    );

    const authUrl = result.challengeData.authorization_url as string;
    return c.redirect(authUrl);
  });

  // ═══════════════════════════════════════════════
  // GET /callback — OAuth redirect callback
  // ═══════════════════════════════════════════════
  app.get("/callback", async (c) => {
    const code = c.req.query("code");
    const state = c.req.query("state");

    if (!code || !state) {
      return oauthError(c, 400, "invalid_request", "missing code or state");
    }

    const session = await repo.getAuthSession(state);
    if (!session) {
      return oauthError(c, 400, "invalid_grant", "session not found or expired");
    }

    const provider = registry.get(session.providerName);
    const params: Record<string, string> = {};
    for (const [k, v] of new URL(c.req.url).searchParams) {
      params[k] = v;
    }

    let result;
    try {
      result = await provider.callbackAuth(session, params);
    } catch (err: any) {
      await repo.deleteAuthSession(state);
      return oauthError(c, 502, "server_error", err.message);
    }

    const encAccess = await encrypt(result.accessToken, secret);
    const encRefresh = await encrypt(result.refreshToken, secret);
    const conn = await repo.createConnection({
      provider: session.providerName,
      providerUid: result.providerUid,
      displayName: result.displayName,
      tokenInject: provider.tokenInjectMethod,
      credentials: { accessToken: encAccess, refreshToken: encRefresh },
    });

    const exchangeCode = await repo.createAuthCode(conn.id, 300);
    await repo.deleteAuthSession(state);

    const redirectUri = session.challengeData.redirect_uri as string;
    if (redirectUri) {
      const url = new URL(redirectUri);
      url.searchParams.set("code", exchangeCode);
      url.searchParams.set("state", (session.challengeData.state as string) || "");
      return c.redirect(url.toString());
    }

    return c.json({ code: exchangeCode });
  });

  // ═══════════════════════════════════════════════
  // POST /token — RFC 6749 §3.2
  // ═══════════════════════════════════════════════
  app.post("/token", zValidator("form", tokenRequestSchema, zodHook), async (c) => {
    const {
      grant_type: grantType,
      device_code: deviceCode,
      code,
      client_id: clientId,
      client_secret: clientSecret,
      redirect_uri: redirectUri,
      code_verifier: codeVerifier,
    } = c.req.valid("form");

    switch (grantType) {
      // ─── Device Flow polling (RFC 8628 §3.4) ───
      case "urn:ietf:params:oauth:grant-type:device_code": {
        if (!deviceCode) {
          return oauthError(c, 400, "invalid_request", "device_code is required");
        }

        const session = await repo.getAuthSession(deviceCode);
        if (!session) {
          return oauthError(c, 400, "expired_token", "device code expired");
        }
        if (session.expiresAt < Date.now()) {
          await repo.deleteAuthSession(deviceCode);
          return oauthError(c, 400, "expired_token", "device code expired");
        }

        if (session.result && session.authCode) {
          const connId = await repo.consumeAuthCode(session.authCode);
          if (!connId) {
            return oauthError(c, 400, "invalid_grant", "auth code already consumed");
          }
          const conn = await repo.getConnectionById(connId);
          await repo.deleteAuthSession(deviceCode);
          return c.json({
            access_token: conn!.apiKey,
            token_type: "Bearer",
            scope: session.providerName,
            provider: session.providerName,
            provider_uid: conn!.providerUid,
            display_name: conn!.displayName,
          });
        }

        if (session.error) {
          await repo.deleteAuthSession(deviceCode);
          return oauthError(c, 400, "access_denied", session.error);
        }

        // Client-driven polling
        const provider = registry.get(session.providerName);
        let pollResult;
        try {
          pollResult = await provider.pollAuth(session);
        } catch (err: any) {
          await repo.setAuthSession(deviceCode, { ...session, error: err.message }, 300);
          return oauthError(c, 400, "access_denied", err.message);
        }

        if (pollResult.error) {
          await repo.setAuthSession(deviceCode, { ...session, error: pollResult.error }, 300);
          return oauthError(c, 400, "access_denied", pollResult.error);
        }

        if (pollResult.result) {
          const encAccess = await encrypt(pollResult.result.accessToken, secret);
          const encRefresh = await encrypt(pollResult.result.refreshToken, secret);
          const conn = await repo.createConnection({
            provider: session.providerName,
            providerUid: pollResult.result.providerUid,
            displayName: pollResult.result.displayName,
            tokenInject: provider.tokenInjectMethod,
            credentials: { accessToken: encAccess, refreshToken: encRefresh },
          });

          await repo.deleteAuthSession(deviceCode);
          return c.json({
            access_token: conn.apiKey,
            token_type: "Bearer",
            scope: session.providerName,
            provider: session.providerName,
            provider_uid: conn.providerUid,
            display_name: conn.displayName,
          });
        }

        if (pollResult.updatedChallenge) {
          await repo.setAuthSession(
            deviceCode,
            {
              ...session,
              challengeData: { ...session.challengeData, ...pollResult.updatedChallenge },
            },
            300,
          );
        }

        return oauthError(
          c,
          400,
          "authorization_pending",
          "user has not yet completed authorization",
        );
      }

      // ─── Authorization Code exchange (RFC 6749 §4.1.3) ───
      case "authorization_code": {
        if (!code) {
          return oauthError(c, 400, "invalid_request", "code is required");
        }

        const [sid] = code.split(".");
        if (sid?.startsWith("external_connect_")) {
          try {
            const result = await exchangeExternalConnectAuthorizationCode(repo, secret, {
              code,
              client_id: clientId,
              client_secret: clientSecret,
              redirect_uri: redirectUri,
              code_verifier: codeVerifier,
            });
            return c.json(result.response);
          } catch (error) {
            const oauthError = externalConnectOAuthError(error);
            return c.json(oauthError.body, oauthError.status as 400);
          }
        }

        const connId = await repo.consumeAuthCode(code);
        if (!connId) {
          return oauthError(c, 400, "invalid_grant", "invalid or expired authorization code");
        }

        const conn = await repo.getConnectionById(connId);
        if (!conn) {
          return oauthError(c, 400, "invalid_grant", "connection not found");
        }

        return c.json({
          access_token: conn.apiKey,
          token_type: "Bearer",
          scope: conn.provider,
          provider: conn.provider,
          provider_uid: conn.providerUid,
          display_name: conn.displayName,
        });
      }

      default:
        return oauthError(c, 400, "unsupported_grant_type", `unsupported grant_type: ${grantType}`);
    }
  });

  // ═══════════════════════════════════════════════
  // POST /revoke — RFC 7009
  // ═══════════════════════════════════════════════
  app.post("/revoke", zValidator("form", revokeSchema, zodHook), async (c) => {
    const { token } = c.req.valid("form");
    await repo.revokeApiKey(token);
    return c.json({});
  });

  // ═══════════════════════════════════════════════
  // POST /introspect — RFC 7662
  // ═══════════════════════════════════════════════
  app.post("/introspect", zValidator("form", introspectSchema, zodHook), async (c) => {
    const { token } = c.req.valid("form");
    const conn = await repo.getConnectionByApiKey(token);
    if (!conn) {
      return c.json({ active: false });
    }
    return c.json({
      active: true,
      scope: conn.provider,
      client_id: conn.id,
      token_type: "Bearer",
      sub: conn.providerUid,
      username: conn.displayName,
      iat: conn.createdAt,
    });
  });

  // ═══════════════════════════════════════════════
  // GET /providers
  // ═══════════════════════════════════════════════
  app.get("/providers", (c) => {
    const providers = registry.all().map((p) => ({
      name: p.name,
      flow: p.flow,
      grant_type:
        p.flow === "poll" ? "urn:ietf:params:oauth:grant-type:device_code" : "authorization_code",
    }));
    return c.json({ providers });
  });

  return app;
}
