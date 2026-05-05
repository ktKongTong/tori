import { describe, expect, it } from "vite-plus/test";
import { createApp } from "../src/app.ts";
import { MemoryRepository } from "./memory-repo.ts";

const SECRET = "test-secret-must-be-32-chars!!!!";
const ADMIN_KEY = "test-admin-key";

function setup() {
  const repo = new MemoryRepository();
  const app = createApp({ repo, secret: SECRET, adminKey: ADMIN_KEY });
  return { repo, app };
}

function req(
  app: any,
  method: string,
  path: string,
  opts: {
    headers?: Record<string, string>;
    body?: any;
  } = {},
) {
  const init: RequestInit = { method, headers: opts.headers || {} };
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

describe("health", () => {
  it("GET /health returns ok", async () => {
    const { app } = setup();
    const res = await req(app, "GET", "/health");
    expect(res.status).toBe(200);
    const data = await res.json();
    expect(data.status).toBe("ok");
    expect(data.service).toBe("token-proxy");
  });
});

describe("oauth", () => {
  describe("POST /oauth/device/authorize", () => {
    it("requires admin key", async () => {
      const { app } = setup();
      const res = await req(app, "POST", "/oauth/device/authorize", {
        body: { provider: "steam" },
      });
      expect(res.status).toBe(401);
    });

    it("requires provider", async () => {
      const { app } = setup();
      const res = await req(app, "POST", "/oauth/device/authorize", {
        headers: { "X-Admin-Key": ADMIN_KEY },
        body: {},
      });
      expect(res.status).toBe(400);
      const data = await res.json();
      expect(data.error).toBe("invalid_request");
    });

    it("rejects unknown provider", async () => {
      const { app } = setup();
      const res = await req(app, "POST", "/oauth/device/authorize", {
        headers: { "X-Admin-Key": ADMIN_KEY },
        body: { provider: "nonexistent" },
      });
      expect(res.status).toBe(400);
      expect((await res.json()).error).toBe("invalid_request");
    });
  });

  describe("POST /oauth/token", () => {
    it("rejects unsupported grant_type", async () => {
      const { app } = setup();
      const res = await req(app, "POST", "/oauth/token", {
        body: "grant_type=password",
      });
      expect(res.status).toBe(400);
      const data = await res.json();
      expect(data.error).toBe("unsupported_grant_type");
    });

    it("rejects device_code without code", async () => {
      const { app } = setup();
      const res = await req(app, "POST", "/oauth/token", {
        body: "grant_type=urn%3Aietf%3Aparams%3Aoauth%3Agrant-type%3Adevice_code",
      });
      expect(res.status).toBe(400);
      expect((await res.json()).error).toBe("invalid_request");
    });

    it("rejects expired device_code", async () => {
      const { app } = setup();
      const res = await req(app, "POST", "/oauth/token", {
        body: "grant_type=urn%3Aietf%3Aparams%3Aoauth%3Agrant-type%3Adevice_code&device_code=dc_nonexistent",
      });
      expect(res.status).toBe(400);
      expect((await res.json()).error).toBe("expired_token");
    });

    it("exchanges authorization_code for access_token", async () => {
      const { repo, app } = setup();
      // Setup: create connection + auth code
      const conn = await repo.createConnection({
        provider: "steam",
        providerUid: "7656119800000000",
        displayName: "TestUser",
        tokenInject: "bearer",
        credentials: { accessToken: "enc_at", refreshToken: "enc_rt" },
      });
      const code = await repo.createAuthCode(conn.id, 300);

      const res = await req(app, "POST", "/oauth/token", {
        body: `grant_type=authorization_code&code=${code}`,
      });
      expect(res.status).toBe(200);
      const data = await res.json();
      expect(data.access_token).toBe(conn.apiKey);
      expect(data.token_type).toBe("Bearer");
      expect(data.provider).toBe("steam");
      expect(data.provider_uid).toBe("7656119800000000");
    });

    it("rejects already consumed auth code", async () => {
      const { repo, app } = setup();
      const conn = await repo.createConnection({
        provider: "steam",
        providerUid: "123",
        displayName: "Test",
        tokenInject: "bearer",
        credentials: { accessToken: "x", refreshToken: "y" },
      });
      const code = await repo.createAuthCode(conn.id, 300);

      // First exchange
      const r1 = await req(app, "POST", "/oauth/token", {
        body: `grant_type=authorization_code&code=${code}`,
      });
      expect(r1.status).toBe(200);

      // Second exchange — should fail
      const r2 = await req(app, "POST", "/oauth/token", {
        body: `grant_type=authorization_code&code=${code}`,
      });
      expect(r2.status).toBe(400);
      expect((await r2.json()).error).toBe("invalid_grant");
    });
  });

  describe("POST /oauth/revoke", () => {
    it("requires admin key", async () => {
      const { app } = setup();
      const res = await req(app, "POST", "/oauth/revoke", {
        body: "token=anything",
      });
      expect(res.status).toBe(401);
    });

    it("revokes a token", async () => {
      const { repo, app } = setup();
      const conn = await repo.createConnection({
        provider: "steam",
        providerUid: "123",
        displayName: "Test",
        tokenInject: "bearer",
        credentials: { accessToken: "x", refreshToken: "y" },
      });

      const res = await req(app, "POST", "/oauth/revoke", {
        headers: { "X-Admin-Key": ADMIN_KEY },
        body: `token=${conn.apiKey}`,
      });
      expect(res.status).toBe(200);

      // Connection should be revoked
      const updated = await repo.getConnectionByApiKey(conn.apiKey);
      expect(updated).toBeNull();
    });
  });

  describe("POST /oauth/introspect", () => {
    it("returns active=false for unknown token", async () => {
      const { app } = setup();
      const res = await req(app, "POST", "/oauth/introspect", {
        headers: { "X-Admin-Key": ADMIN_KEY },
        body: "token=fake_token",
      });
      expect(res.status).toBe(200);
      expect((await res.json()).active).toBe(false);
    });

    it("returns active=true for valid token", async () => {
      const { repo, app } = setup();
      const conn = await repo.createConnection({
        provider: "steam",
        providerUid: "7656119800000000",
        displayName: "TestUser",
        tokenInject: "bearer",
        credentials: { accessToken: "x", refreshToken: "y" },
      });

      const res = await req(app, "POST", "/oauth/introspect", {
        headers: { "X-Admin-Key": ADMIN_KEY },
        body: `token=${conn.apiKey}`,
      });
      expect(res.status).toBe(200);
      const data = await res.json();
      expect(data.active).toBe(true);
      expect(data.sub).toBe("7656119800000000");
      expect(data.scope).toBe("steam");
    });
  });
});
