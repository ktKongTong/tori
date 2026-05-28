import { beforeEach, describe, expect, it, vi } from "vite-plus/test";
import { createApp } from "../src/app.ts";
import { encrypt } from "../src/crypto/index.ts";
import { MemoryRepository } from "../src/repository/memory.ts";

const SECRET = "test-secret-must-be-32-chars!!!!";
const ADMIN_KEY = "test-admin-key";

// Mock fetch for upstream proxy calls
const mockFetch = vi.fn();
vi.stubGlobal("fetch", mockFetch);

function setup() {
  const repo = new MemoryRepository();
  const app = createApp({ repo, secret: SECRET, adminKey: ADMIN_KEY });
  return { repo, app };
}

async function createTestConnection(
  repo: MemoryRepository,
  opts: {
    provider?: string;
    tokenInject?: string;
  } = {},
) {
  const accessToken = await encrypt("real-steam-token-123", SECRET);
  const refreshToken = await encrypt("real-refresh-token", SECRET);
  return repo.createConnection({
    provider: opts.provider || "steam",
    providerUid: "7656119800000000",
    displayName: "TestUser",
    tokenInject: opts.tokenInject || "bearer",
    credentials: { accessToken, refreshToken },
  });
}

describe("proxy", () => {
  beforeEach(() => {
    mockFetch.mockReset();
  });

  describe("authentication", () => {
    it("rejects missing X-API-KEY", async () => {
      const { app } = setup();
      const res = await app.request("http://localhost/proxy/steam", {
        method: "GET",
        headers: { "X-PROXY-URL": "https://api.steampowered.com/test" },
      });
      expect(res.status).toBe(401);
    });

    it("rejects invalid X-API-KEY", async () => {
      const { app } = setup();
      const res = await app.request("http://localhost/proxy/steam", {
        method: "GET",
        headers: {
          "X-API-KEY": "invalid_key",
          "X-PROXY-URL": "https://api.steampowered.com/test",
        },
      });
      expect(res.status).toBe(401);
    });
  });

  describe("provider validation", () => {
    it("rejects provider mismatch", async () => {
      const { repo, app } = setup();
      const conn = await createTestConnection(repo, { provider: "steam" });

      const res = await app.request("http://localhost/proxy/github", {
        method: "GET",
        headers: {
          "X-API-KEY": conn.apiKey,
          "X-PROXY-URL": "https://api.github.com/user",
        },
      });
      expect(res.status).toBe(403);
      const data = (await res.json()) as any;
      expect(data.error).toBe("forbidden");
    });
  });

  describe("X-PROXY-URL validation", () => {
    it("rejects missing X-PROXY-URL", async () => {
      const { repo, app } = setup();
      const conn = await createTestConnection(repo);

      const res = await app.request("http://localhost/proxy/steam", {
        method: "GET",
        headers: { "X-API-KEY": conn.apiKey },
      });
      expect(res.status).toBe(400);
      const data = (await res.json()) as any;
      expect(data.error).toBe("invalid_request");
    });

    it("rejects invalid URL", async () => {
      const { repo, app } = setup();
      const conn = await createTestConnection(repo);

      const res = await app.request("http://localhost/proxy/steam", {
        method: "GET",
        headers: {
          "X-API-KEY": conn.apiKey,
          "X-PROXY-URL": "not-a-url",
        },
      });
      expect(res.status).toBe(400);
    });
  });

  describe("proxy rules", () => {
    it("allows when no rules configured", async () => {
      const { repo, app } = setup();
      const conn = await createTestConnection(repo);

      mockFetch.mockResolvedValueOnce(
        new Response('{"ok":true}', {
          status: 200,
          headers: { "Content-Type": "application/json" },
        }),
      );

      const res = await app.request("http://localhost/proxy/steam", {
        method: "GET",
        headers: {
          "X-API-KEY": conn.apiKey,
          "X-PROXY-URL": "https://api.steampowered.com/ISteamUser/GetPlayerSummaries/v2/",
        },
      });
      expect(res.status).toBe(200);
    });

    it("rejects when URL not in allowed rules", async () => {
      const { repo, app } = setup();
      const conn = await createTestConnection(repo);

      repo.proxyRules.push({
        id: 1,
        provider: "steam",
        allowedHost: "api.steampowered.com",
        pathPattern: "/ISteamUser/",
        methods: "GET",
      });

      const res = await app.request("http://localhost/proxy/steam", {
        method: "GET",
        headers: {
          "X-API-KEY": conn.apiKey,
          "X-PROXY-URL": "https://evil.example.com/steal",
        },
      });
      expect(res.status).toBe(403);
    });

    it("allows when URL matches rules", async () => {
      const { repo, app } = setup();
      const conn = await createTestConnection(repo);

      repo.proxyRules.push({
        id: 1,
        provider: "steam",
        allowedHost: "api.steampowered.com",
        pathPattern: "/ISteamUser/",
        methods: "GET",
      });

      mockFetch.mockResolvedValueOnce(new Response("ok", { status: 200 }));

      const res = await app.request("http://localhost/proxy/steam", {
        method: "GET",
        headers: {
          "X-API-KEY": conn.apiKey,
          "X-PROXY-URL": "https://api.steampowered.com/ISteamUser/GetPlayerSummaries/v2/",
        },
      });
      expect(res.status).toBe(200);
    });
  });

  describe("token injection", () => {
    it("injects bearer token", async () => {
      const { repo, app } = setup();
      const conn = await createTestConnection(repo, { tokenInject: "bearer" });

      mockFetch.mockResolvedValueOnce(new Response("ok", { status: 200 }));

      await app.request("http://localhost/proxy/steam", {
        method: "GET",
        headers: {
          "X-API-KEY": conn.apiKey,
          "X-PROXY-URL": "https://api.steampowered.com/test",
        },
      });

      expect(mockFetch).toHaveBeenCalledOnce();
      const [url, init] = mockFetch.mock.calls[0];
      expect(url).toBe("https://api.steampowered.com/test");
      const authHeader = (init.headers as Headers).get("Authorization");
      expect(authHeader).toBe("Bearer real-steam-token-123");
    });

    it("injects query parameter token", async () => {
      const { repo, app } = setup();
      const conn = await createTestConnection(repo, { tokenInject: "query:access_token" });

      mockFetch.mockResolvedValueOnce(new Response("ok", { status: 200 }));

      await app.request("http://localhost/proxy/steam", {
        method: "GET",
        headers: {
          "X-API-KEY": conn.apiKey,
          "X-PROXY-URL": "https://api.steampowered.com/test",
        },
      });

      const [url] = mockFetch.mock.calls[0];
      expect(url).toContain("access_token=real-steam-token-123");
      const [log] = await repo.listRequestLogs({ connectionId: conn.id });
      expect(log.targetUrl).toContain("access_token=%5Bredacted%5D");
      expect(log.query?.access_token).toBe("[redacted]");
    });

    it("injects custom header token", async () => {
      const { repo, app } = setup();
      const conn = await createTestConnection(repo, { tokenInject: "header:X-Steam-Token" });

      mockFetch.mockResolvedValueOnce(new Response("ok", { status: 200 }));

      await app.request("http://localhost/proxy/steam", {
        method: "GET",
        headers: {
          "X-API-KEY": conn.apiKey,
          "X-PROXY-URL": "https://api.steampowered.com/test",
        },
      });

      const [, init] = mockFetch.mock.calls[0];
      expect((init.headers as Headers).get("X-Steam-Token")).toBe("real-steam-token-123");
    });
  });

  describe("method & body passthrough", () => {
    it("passes through GET", async () => {
      const { repo, app } = setup();
      const conn = await createTestConnection(repo);

      mockFetch.mockResolvedValueOnce(
        new Response('{"result":"ok"}', {
          status: 200,
          headers: { "Content-Type": "application/json" },
        }),
      );

      const res = await app.request("http://localhost/proxy/steam", {
        method: "GET",
        headers: {
          "X-API-KEY": conn.apiKey,
          "X-PROXY-URL": "https://api.steampowered.com/test",
        },
      });

      expect(res.status).toBe(200);
      expect(await res.json()).toEqual({ result: "ok" });
      expect(mockFetch.mock.calls[0][1].method).toBe("GET");
    });

    it("passes through POST with body", async () => {
      const { repo, app } = setup();
      const conn = await createTestConnection(repo);

      mockFetch.mockResolvedValueOnce(new Response("created", { status: 201 }));

      const body = JSON.stringify({ key: "value" });
      const res = await app.request("http://localhost/proxy/steam", {
        method: "POST",
        headers: {
          "X-API-KEY": conn.apiKey,
          "X-PROXY-URL": "https://api.steampowered.com/test",
          "Content-Type": "application/json",
        },
        body,
      });

      expect(res.status).toBe(201);
      expect(mockFetch.mock.calls[0][1].method).toBe("POST");
      const [log] = await repo.listRequestLogs({ connectionId: conn.id });
      expect(log.headers?.["x-api-key"]).toBe("[redacted]");
      expect(log.headers?.["content-type"]).toBe("application/json");
      expect(log.requestBody).toEqual({ key: "value" });
    });

    it("redacts sensitive headers, query values, and JSON body fields", async () => {
      const { repo, app } = setup();
      const conn = await createTestConnection(repo);

      mockFetch.mockResolvedValueOnce(new Response("created", { status: 201 }));

      const res = await app.request("http://localhost/proxy/steam", {
        method: "POST",
        headers: {
          "X-API-KEY": conn.apiKey,
          "X-PROXY-URL":
            "https://api.steampowered.com/test?access_token=query-access&token=query-token&safe=ok",
          "Content-Type": "application/json",
          Authorization: "Bearer inbound",
          Cookie: "session=inbound",
        },
        body: JSON.stringify({
          token: "body-token",
          refresh_token: "body-refresh",
          nested: {
            access_token: "nested-access",
            safe: "value",
          },
        }),
      });

      expect(res.status).toBe(201);
      const [log] = await repo.listRequestLogs({ connectionId: conn.id });
      expect(log.headers?.authorization).toBe("[redacted]");
      expect(log.headers?.cookie).toBe("[redacted]");
      expect(log.headers?.["x-api-key"]).toBe("[redacted]");
      expect(log.targetUrl).toContain("access_token=%5Bredacted%5D");
      expect(log.targetUrl).toContain("token=%5Bredacted%5D");
      expect(log.query).toMatchObject({
        access_token: "[redacted]",
        token: "[redacted]",
        safe: "ok",
      });
      expect(log.requestBody).toEqual({
        token: "[redacted]",
        refresh_token: "[redacted]",
        nested: {
          access_token: "[redacted]",
          safe: "value",
        },
      });
    });

    it("passes through upstream error status", async () => {
      const { repo, app } = setup();
      const conn = await createTestConnection(repo);

      mockFetch.mockResolvedValueOnce(new Response("not found", { status: 404 }));

      const res = await app.request("http://localhost/proxy/steam", {
        method: "GET",
        headers: {
          "X-API-KEY": conn.apiKey,
          "X-PROXY-URL": "https://api.steampowered.com/nonexistent",
        },
      });

      expect(res.status).toBe(404);
      expect(await res.text()).toBe("not found");
    });

    it("passes through upstream headers", async () => {
      const { repo, app } = setup();
      const conn = await createTestConnection(repo);

      mockFetch.mockResolvedValueOnce(
        new Response("data", {
          status: 200,
          headers: {
            "Content-Type": "text/plain",
            "X-Custom": "upstream-value",
          },
        }),
      );

      const res = await app.request("http://localhost/proxy/steam", {
        method: "GET",
        headers: {
          "X-API-KEY": conn.apiKey,
          "X-PROXY-URL": "https://api.steampowered.com/test",
        },
      });

      expect(res.headers.get("X-Custom")).toBe("upstream-value");
    });
  });

  describe("upstream error handling", () => {
    it("returns 502 when upstream fetch fails", async () => {
      const { repo, app } = setup();
      const conn = await createTestConnection(repo);

      mockFetch.mockRejectedValueOnce(new Error("ECONNREFUSED"));

      const res = await app.request("http://localhost/proxy/steam", {
        method: "GET",
        headers: {
          "X-API-KEY": conn.apiKey,
          "X-PROXY-URL": "https://api.steampowered.com/test",
        },
      });

      expect(res.status).toBe(502);
      const data = (await res.json()) as any;
      expect(data.error).toBe("upstream_error");
    });
  });
});
