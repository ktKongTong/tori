/**
 * Integration test: full auth + proxy flow with a mock provider.
 *
 * Tests the real app (createApp) with an in-memory repo and a
 * mock "test" provider that simulates device flow.
 */

import { Hono } from "hono";
import { beforeAll, describe, expect, it, vi } from "vite-plus/test";
import { encrypt } from "../src/crypto/index.ts";
import { ProviderRegistry } from "../src/provider/registry.ts";
import type { PollResult, Provider } from "../src/provider/types.ts";
import type { AuthResult, AuthSessionState } from "../src/types.ts";
import { MemoryRepository } from "./memory-repo.ts";

const SECRET = "integration-test-secret-32chars!";
const ADMIN_KEY = "int-test-admin";

// ─── Mock Provider ───
// Simulates a device flow provider where the user "approves" after N polls

class MockProvider implements Provider {
  name = "mockprovider";
  flow = "poll" as const;
  tokenInjectMethod = "bearer";
  pollCount = 0;
  approveAfter = 2; // approve on 3rd poll

  async beginAuth() {
    this.pollCount = 0;
    return {
      challengeData: {
        qrUrl: "https://mock.example.com/qr/12345",
        interval: 1,
      },
    };
  }

  async pollAuth(_session: AuthSessionState): Promise<PollResult> {
    this.pollCount++;
    if (this.pollCount >= this.approveAfter) {
      return {
        result: {
          providerUid: "mock_uid_999",
          displayName: "MockUser",
          accessToken: "mock-real-access-token-secret",
          refreshToken: "mock-real-refresh-token-secret",
        },
      };
    }
    return {}; // pending
  }

  async callbackAuth(): Promise<AuthResult> {
    throw new Error("not supported");
  }

  async refreshToken() {
    return { accessToken: "new-mock-token" };
  }
}

// ─── Build app with mock provider ───

let app: Hono;
let repo: MemoryRepository;
let mockProvider: MockProvider;

import { cors } from "hono/cors";
// We need to inject the mock provider into the app.
// Since createApp registers SteamProvider internally, we'll create
// the app differently for integration tests.
import { adminKeyAuth, apiKeyAuth } from "../src/middleware/auth.ts";
import { healthRoutes } from "../src/routes/health.ts";
import { oauthRoutes } from "../src/routes/oauth.ts";
import { proxyRoutes } from "../src/routes/proxy.ts";

function createTestApp() {
  repo = new MemoryRepository();
  mockProvider = new MockProvider();

  const registry = new ProviderRegistry();
  registry.register(mockProvider);

  app = new Hono();
  app.use("*", cors());

  app.route("/", healthRoutes());

  app.use("/oauth/device/*", adminKeyAuth(ADMIN_KEY));
  app.use("/oauth/authorize", adminKeyAuth(ADMIN_KEY));
  app.use("/oauth/providers", adminKeyAuth(ADMIN_KEY));
  app.use("/oauth/revoke", adminKeyAuth(ADMIN_KEY));
  app.use("/oauth/introspect", adminKeyAuth(ADMIN_KEY));

  app.route("/oauth", oauthRoutes({ repo, registry, secret: SECRET }));

  app.use("/proxy/*", apiKeyAuth(repo));
  app.route("/proxy", proxyRoutes({ repo, secret: SECRET }));

  app.use("/account", apiKeyAuth(repo));
  app.get("/account", (c) => {
    const conn = c.get("connection") as any;
    return c.json({
      connection_id: conn.id,
      provider: conn.provider,
      provider_uid: conn.providerUid,
      display_name: conn.displayName,
      status: conn.status,
    });
  });

  return app;
}

// ─── Helper ───

function request(
  method: string,
  path: string,
  opts: {
    headers?: Record<string, string>;
    body?: string | object;
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

// Mock fetch for proxy upstream calls
const mockFetch = vi.fn();
vi.stubGlobal("fetch", mockFetch);

// ─── Tests ───

describe("integration: full auth + proxy flow", () => {
  beforeAll(() => {
    createTestApp();
  });

  let deviceCode: string;
  let apiKey: string;

  it("step 1: health check", async () => {
    const res = await request("GET", "/health");
    expect(res.status).toBe(200);
    expect(((await res.json()) as any).status).toBe("ok");
  });

  it("step 2: list providers", async () => {
    const res = await request("GET", "/oauth/providers", {
      headers: { "X-Admin-Key": ADMIN_KEY },
    });
    expect(res.status).toBe(200);
    const data = (await res.json()) as any;
    expect(data.providers).toHaveLength(1);
    expect(data.providers[0].name).toBe("mockprovider");
    expect(data.providers[0].flow).toBe("poll");
  });

  it("step 3: begin device auth", async () => {
    const res = await request("POST", "/oauth/device/authorize", {
      headers: { "X-Admin-Key": ADMIN_KEY },
      body: { provider: "mockprovider" },
    });
    expect(res.status).toBe(200);
    const data = (await res.json()) as any;
    expect(data.device_code).toBeDefined();
    expect(data.verification_uri).toBe("https://mock.example.com/qr/12345");
    expect(data.expires_in).toBe(300);
    expect(data.interval).toBe(1);
    deviceCode = data.device_code;
  });

  it("step 4: poll — first attempt (pending)", async () => {
    const res = await request("POST", "/oauth/token", {
      body: `grant_type=urn%3Aietf%3Aparams%3Aoauth%3Agrant-type%3Adevice_code&device_code=${deviceCode}`,
    });
    expect(res.status).toBe(400);
    const data = (await res.json()) as any;
    expect(data.error).toBe("authorization_pending");
  });

  it("step 5: poll — user approves, get access_token", async () => {
    const res = await request("POST", "/oauth/token", {
      body: `grant_type=urn%3Aietf%3Aparams%3Aoauth%3Agrant-type%3Adevice_code&device_code=${deviceCode}`,
    });
    expect(res.status).toBe(200);
    const data = (await res.json()) as any;
    expect(data.access_token).toBeDefined();
    expect(data.access_token).toMatch(/^ak_/);
    expect(data.token_type).toBe("Bearer");
    expect(data.provider).toBe("mockprovider");
    expect(data.provider_uid).toBe("mock_uid_999");
    expect(data.display_name).toBe("MockUser");
    apiKey = data.access_token;
  });

  it("step 6: introspect the token", async () => {
    const res = await request("POST", "/oauth/introspect", {
      headers: { "X-Admin-Key": ADMIN_KEY },
      body: `token=${apiKey}`,
    });
    expect(res.status).toBe(200);
    const data = (await res.json()) as any;
    expect(data.active).toBe(true);
    expect(data.sub).toBe("mock_uid_999");
    expect(data.username).toBe("MockUser");
    expect(data.scope).toBe("mockprovider");
  });

  it("step 7: get account info", async () => {
    const res = await request("GET", "/account", {
      headers: { "X-API-KEY": apiKey },
    });
    expect(res.status).toBe(200);
    const data = (await res.json()) as any;
    expect(data.provider).toBe("mockprovider");
    expect(data.provider_uid).toBe("mock_uid_999");
    expect(data.display_name).toBe("MockUser");
    expect(data.status).toBe("active");
  });

  it("step 8: proxy request — token injected", async () => {
    mockFetch.mockResolvedValueOnce(
      new Response(JSON.stringify({ player: { name: "MockUser", level: 42 } }), {
        status: 200,
        headers: { "Content-Type": "application/json" },
      }),
    );

    const res = await request("GET", "/proxy/mockprovider", {
      headers: {
        "X-API-KEY": apiKey,
        "X-PROXY-URL": "https://api.mockprovider.com/v1/user/profile",
      },
    });

    expect(res.status).toBe(200);
    const data = (await res.json()) as any;
    expect(data.player.name).toBe("MockUser");

    // Verify token was injected
    const [url, init] = mockFetch.mock.calls[0];
    expect(url).toBe("https://api.mockprovider.com/v1/user/profile");
    const authHeader = (init.headers as Headers).get("Authorization");
    expect(authHeader).toBe("Bearer mock-real-access-token-secret");
  });

  it("step 9: proxy POST passthrough", async () => {
    mockFetch.mockResolvedValueOnce(
      new Response('{"updated":true}', {
        status: 200,
        headers: { "Content-Type": "application/json" },
      }),
    );

    const res = await request("POST", "/proxy/mockprovider", {
      headers: {
        "X-API-KEY": apiKey,
        "X-PROXY-URL": "https://api.mockprovider.com/v1/action",
        "Content-Type": "application/json",
      },
      body: { action: "do_something", value: 123 },
    });

    expect(res.status).toBe(200);
    const [, init] = mockFetch.mock.calls[1];
    expect(init.method).toBe("POST");
  });

  it("step 10: proxy wrong provider — rejected", async () => {
    const res = await request("GET", "/proxy/steam", {
      headers: {
        "X-API-KEY": apiKey,
        "X-PROXY-URL": "https://api.steampowered.com/test",
      },
    });
    expect(res.status).toBe(403);
    const data = (await res.json()) as any;
    expect(data.error).toBe("forbidden");
  });

  it("step 11: revoke token", async () => {
    const res = await request("POST", "/oauth/revoke", {
      headers: { "X-Admin-Key": ADMIN_KEY },
      body: `token=${apiKey}`,
    });
    expect(res.status).toBe(200);
  });

  it("step 12: revoked token cannot proxy", async () => {
    const res = await request("GET", "/proxy/mockprovider", {
      headers: {
        "X-API-KEY": apiKey,
        "X-PROXY-URL": "https://api.mockprovider.com/v1/user/profile",
      },
    });
    expect(res.status).toBe(401);
  });

  it("step 13: introspect revoked token — inactive", async () => {
    const res = await request("POST", "/oauth/introspect", {
      headers: { "X-Admin-Key": ADMIN_KEY },
      body: `token=${apiKey}`,
    });
    expect(res.status).toBe(200);
    const data = (await res.json()) as any;
    expect(data.active).toBe(false);
  });
});

describe("integration: error cases", () => {
  beforeAll(() => {
    createTestApp();
  });

  it("device auth without admin key", async () => {
    const res = await request("POST", "/oauth/device/authorize", {
      body: { provider: "mockprovider" },
    });
    expect(res.status).toBe(401);
  });

  it("device auth with unknown provider", async () => {
    const res = await request("POST", "/oauth/device/authorize", {
      headers: { "X-Admin-Key": ADMIN_KEY },
      body: { provider: "unknown" },
    });
    expect(res.status).toBe(400);
    expect(((await res.json()) as any).error).toBe("invalid_request");
  });

  it("token with expired device code", async () => {
    const res = await request("POST", "/oauth/token", {
      body: "grant_type=urn%3Aietf%3Aparams%3Aoauth%3Agrant-type%3Adevice_code&device_code=dc_nonexistent",
    });
    expect(res.status).toBe(400);
    expect(((await res.json()) as any).error).toBe("expired_token");
  });

  it("proxy without X-PROXY-URL", async () => {
    // Create a connection directly for this test
    const conn = await repo.createConnection({
      provider: "mockprovider",
      providerUid: "test",
      displayName: "Test",
      tokenInject: "bearer",
      credentials: {
        accessToken: await encrypt("tok", SECRET),
        refreshToken: await encrypt("ref", SECRET),
      },
    });

    const res = await request("GET", "/proxy/mockprovider", {
      headers: { "X-API-KEY": conn.apiKey },
    });
    expect(res.status).toBe(400);
    expect(((await res.json()) as any).error).toBe("invalid_request");
  });
});
