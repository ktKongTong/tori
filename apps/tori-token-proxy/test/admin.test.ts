import { describe, expect, it } from "vite-plus/test";
import { createApp } from "../src/app.ts";
import { ProviderRegistry } from "../src/provider/registry.ts";
import type { PollResult, Provider } from "../src/provider/types.ts";
import type { AuthResult, AuthSessionState } from "../src/types.ts";
import { MemoryRepository } from "../src/repository/memory.ts";

const SECRET = "admin-test-secret-32chars!!!!!";
const ADMIN_KEY = "admin-test-key";

class MockConnectProvider implements Provider {
  name = "mock-connect";
  displayName = "Mock Connect";
  flow = "poll" as const;
  tokenInjectMethod = "bearer";
  pollCount = 0;

  async beginAuth() {
    this.pollCount = 0;
    return {
      challengeData: {
        qrUrl: "https://mock.example.com/connect",
        interval: 1,
      },
    };
  }

  async pollAuth(_session: AuthSessionState): Promise<PollResult> {
    this.pollCount += 1;
    if (this.pollCount < 2) return {};

    return {
      result: {
        providerUid: "mock-user-001",
        displayName: "Mock Admin User",
        accessToken: "mock-access-token",
        refreshToken: "mock-refresh-token",
      },
    };
  }

  async callbackAuth(): Promise<AuthResult> {
    throw new Error("not supported");
  }

  async refreshToken(refreshToken: string) {
    return {
      accessToken: `${refreshToken}-next-access`,
      refreshToken: `${refreshToken}-next-refresh`,
    };
  }
}

function createTestApp() {
  const repo = new MemoryRepository();
  const registry = new ProviderRegistry();
  registry.register(new MockConnectProvider());
  const app = createApp({
    repo,
    secret: SECRET,
    adminKey: ADMIN_KEY,
    registry,
  });

  return { repo, app };
}

function parseCookie(setCookie: string | null) {
  if (!setCookie) throw new Error("missing set-cookie header");
  return setCookie.split(";")[0];
}

function externalConnectSessionId(response: Response) {
  expect(response.status).toBe(302);
  const location = response.headers.get("location");
  expect(location).toBeTruthy();
  const url = new URL(location ?? "", "http://localhost");
  expect(url.pathname).toMatch(/^\/external-connect\/external_connect_[a-f0-9]+$/);
  const sessionId = url.pathname.split("/").at(-1);
  if (!sessionId) throw new Error("missing external connect session id");
  return sessionId;
}

function request(
  app: ReturnType<typeof createApp>,
  method: string,
  path: string,
  opts: {
    headers?: Record<string, string>;
    body?: string | Record<string, unknown>;
  } = {},
) {
  const init: RequestInit = { method, headers: { ...opts.headers } };
  if (opts.body) {
    if (typeof opts.body === "string") {
      init.body = opts.body;
      (init.headers as Record<string, string>)["Content-Type"] =
        "application/x-www-form-urlencoded";
    } else {
      init.body = JSON.stringify(opts.body);
      (init.headers as Record<string, string>)["Content-Type"] = "application/json";
    }
  }

  return app.request(`http://localhost${path}`, init);
}

async function createOAuthClient(app: ReturnType<typeof createApp>, redirectUri: string) {
  const loginResponse = await request(app, "POST", "/admin/auth/login", {
    body: { adminKey: ADMIN_KEY },
  });
  expect(loginResponse.status).toBe(200);
  const cookie = parseCookie(loginResponse.headers.get("set-cookie"));
  const response = await request(app, "POST", "/admin/oauth/clients", {
    headers: { Cookie: cookie },
    body: {
      name: "Tori",
      redirectUris: [redirectUri],
      scopes: ["proxy", "account"],
    },
  });
  expect(response.status).toBe(200);
  return (await response.json()) as {
    client_id: string;
    client_secret: string;
  };
}

describe("admin connect flow", () => {
  it("creates a connection and issues an api key from admin dashboard flow", async () => {
    const { app } = createTestApp();

    const loginResponse = await request(app, "POST", "/admin/auth/login", {
      body: { adminKey: ADMIN_KEY },
    });
    expect(loginResponse.status).toBe(200);
    const cookie = parseCookie(loginResponse.headers.get("set-cookie"));

    const beginResponse = await request(app, "POST", "/admin/connections/connect", {
      headers: { Cookie: cookie },
      body: {
        provider: "mock-connect",
        label: "primary",
        permissions: ["proxy", "account"],
      },
    });
    expect(beginResponse.status).toBe(200);
    const beginData = (await beginResponse.json()) as any;
    expect(beginData.status).toBe("pending");
    expect(beginData.verificationUri).toBe("https://mock.example.com/connect");

    const pendingResponse = await request(
      app,
      "GET",
      `/admin/connections/connect/${beginData.id}`,
      {
        headers: { Cookie: cookie },
      },
    );
    expect(pendingResponse.status).toBe(200);
    expect(((await pendingResponse.json()) as any).status).toBe("pending");

    const completedResponse = await request(
      app,
      "GET",
      `/admin/connections/connect/${beginData.id}`,
      {
        headers: { Cookie: cookie },
      },
    );
    expect(completedResponse.status).toBe(200);
    const completedData = (await completedResponse.json()) as any;
    expect(completedData.status).toBe("completed");
    expect(completedData.apiKey).toMatch(/^ak_/);
    expect(completedData.connection.label).toBe("primary");
    expect(completedData.connection.displayName).toBe("Mock Admin User");

    const listResponse = await request(app, "GET", "/admin/connections", {
      headers: { Cookie: cookie },
    });
    expect(listResponse.status).toBe(200);
    const listData = (await listResponse.json()) as any;
    expect(listData.items).toHaveLength(1);
    expect(listData.items[0].provider).toBe("mock-connect");
    expect(listData.items[0].apiKey).toBe(completedData.apiKey);
  });

  it("creates an externally exchangeable connection for Tori callback flow", async () => {
    const { app } = createTestApp();
    const state = "external-state-0001";
    const callback = "https://tori.example.com/api/integration/connections/token-proxy/callback";
    const client = await createOAuthClient(app, callback);
    const codeVerifier = "verifier-verifier-verifier-verifier-0001-rfc7636";
    const codeChallenge = await crypto.subtle
      .digest("SHA-256", new TextEncoder().encode(codeVerifier))
      .then((digest) =>
        btoa(String.fromCharCode(...new Uint8Array(digest)))
          .replaceAll("+", "-")
          .replaceAll("/", "_")
          .replaceAll("=", ""),
      );

    const startResponse = await request(
      app,
      "GET",
      `/admin/external-connect?client_id=${encodeURIComponent(
        client.client_id,
      )}&redirect_uri=${encodeURIComponent(callback)}&response_type=code&provider=mock-connect&state=${encodeURIComponent(
        state,
      )}&code_challenge=${encodeURIComponent(codeChallenge)}&code_challenge_method=S256&scope=proxy%2Caccount`,
    );
    const sessionId = externalConnectSessionId(startResponse);
    expect(sessionId).toBeTruthy();

    const newResponse = await request(app, "POST", `/admin/external-connect/${sessionId}/new`, {
      body: { state },
    });
    expect(newResponse.status).toBe(200);
    expect(((await newResponse.json()) as any).verificationUri).toBe(
      "https://mock.example.com/connect",
    );

    const pendingResponse = await request(app, "GET", `/admin/external-connect/${sessionId}`);
    expect(pendingResponse.status).toBe(200);
    expect(((await pendingResponse.json()) as any).status).toBe("pending");

    const completedResponse = await request(app, "GET", `/admin/external-connect/${sessionId}`);
    expect(completedResponse.status).toBe(200);
    const completedData = (await completedResponse.json()) as any;
    expect(completedData.status).toBe("completed");
    expect(completedData.providerUid).toBe("mock-user-001");

    const confirmResponse = await request(
      app,
      "POST",
      `/admin/external-connect/${sessionId}/confirm`,
      {
        body: { state },
      },
    );
    expect(confirmResponse.status).toBe(200);
    const confirmData = (await confirmResponse.json()) as any;
    const redirectUrl = new URL(confirmData.redirectUrl);
    expect(`${redirectUrl.origin}${redirectUrl.pathname}`).toBe(callback);
    expect(redirectUrl.searchParams.get("state")).toBe(state);
    const code = redirectUrl.searchParams.get("code");
    expect(code).toMatch(new RegExp(`^${sessionId}\\.tp_code_`));

    const exchangeResponse = await request(app, "POST", "/oauth/token", {
      body: `grant_type=authorization_code&code=${encodeURIComponent(
        code ?? "",
      )}&client_id=${encodeURIComponent(client.client_id)}&client_secret=${encodeURIComponent(
        client.client_secret,
      )}&redirect_uri=${encodeURIComponent(callback)}&code_verifier=${encodeURIComponent(
        codeVerifier,
      )}`,
    });
    expect(exchangeResponse.status).toBe(200);
    const exchangeData = (await exchangeResponse.json()) as any;
    expect(exchangeData.provider).toBe("mock-connect");
    expect(exchangeData.provider_uid).toBe("mock-user-001");
    expect(exchangeData.account.providerAccountName).toBe("Mock Admin User");
    expect(exchangeData.access_token).toMatch(/^ak_/);

    const repeatedExchangeResponse = await request(app, "POST", "/oauth/token", {
      body: `grant_type=authorization_code&code=${encodeURIComponent(
        code ?? "",
      )}&client_id=${encodeURIComponent(client.client_id)}&client_secret=${encodeURIComponent(
        client.client_secret,
      )}&redirect_uri=${encodeURIComponent(callback)}&code_verifier=${encodeURIComponent(
        codeVerifier,
      )}`,
    });
    expect(repeatedExchangeResponse.status).toBe(400);
  });

  it("lets external connect choose an existing token-proxy connection before creating a new one", async () => {
    const { app, repo } = createTestApp();
    const existing = await repo.createConnection({
      provider: "mock-connect",
      providerUid: "mock-user-existing",
      displayName: "Existing Mock User",
      label: "existing",
      permissions: ["proxy", "account"],
      tokenInject: "bearer",
      credentials: {
        accessToken: "encrypted-access-token",
        refreshToken: "encrypted-refresh-token",
      },
    });
    const state = "external-state-0002";
    const callback = "https://tori.example.com/api/integration/connections/token-proxy/callback";
    const client = await createOAuthClient(app, callback);
    const codeVerifier = "verifier-verifier-verifier-verifier-0002-rfc7636";
    const codeChallenge = await crypto.subtle
      .digest("SHA-256", new TextEncoder().encode(codeVerifier))
      .then((digest) =>
        btoa(String.fromCharCode(...new Uint8Array(digest)))
          .replaceAll("+", "-")
          .replaceAll("/", "_")
          .replaceAll("=", ""),
      );

    const startResponse = await request(
      app,
      "GET",
      `/admin/external-connect?client_id=${encodeURIComponent(
        client.client_id,
      )}&redirect_uri=${encodeURIComponent(callback)}&response_type=code&provider=mock-connect&state=${encodeURIComponent(
        state,
      )}&code_challenge=${encodeURIComponent(codeChallenge)}&code_challenge_method=S256&scope=proxy%20account`,
    );
    const sessionId = externalConnectSessionId(startResponse);
    expect(sessionId).toBeTruthy();

    const sessionResponse = await request(app, "GET", `/admin/external-connect/${sessionId}`);
    expect(sessionResponse.status).toBe(200);
    const sessionData = (await sessionResponse.json()) as any;
    expect(sessionData.connections).toHaveLength(1);
    expect(sessionData.connections[0].displayName).toBe("Existing Mock User");

    const confirmResponse = await request(
      app,
      "POST",
      `/admin/external-connect/${sessionId}/confirm`,
      {
        body: { state, connectionId: existing.id },
      },
    );
    expect(confirmResponse.status).toBe(200);
    const confirmData = (await confirmResponse.json()) as any;
    const redirectUrl = new URL(confirmData.redirectUrl);
    expect(`${redirectUrl.origin}${redirectUrl.pathname}`).toBe(callback);
    expect(redirectUrl.searchParams.get("state")).toBe(state);
    const code = redirectUrl.searchParams.get("code");
    expect(code).toMatch(new RegExp(`^${sessionId}\\.tp_code_`));

    const exchangeResponse = await request(app, "POST", "/oauth/token", {
      body: `grant_type=authorization_code&code=${encodeURIComponent(
        code ?? "",
      )}&client_id=${encodeURIComponent(client.client_id)}&client_secret=${encodeURIComponent(
        client.client_secret,
      )}&redirect_uri=${encodeURIComponent(callback)}&code_verifier=${encodeURIComponent(
        codeVerifier,
      )}`,
    });
    expect(exchangeResponse.status).toBe(200);
    const exchangeData = (await exchangeResponse.json()) as any;
    expect(exchangeData.connection.id).toBe(existing.id);
    expect(exchangeData.connection.providerUid).toBe("mock-user-existing");
    expect(exchangeData.account.providerAccountName).toBe("Existing Mock User");
    expect(exchangeData.access_token).toBe(existing.apiKey);
  });
});
