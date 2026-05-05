import { describe, expect, it } from "vite-plus/test";
import { createApp } from "../src/app.ts";
import { ProviderRegistry } from "../src/provider/registry.ts";
import type { PollResult, Provider } from "../src/provider/types.ts";
import type { AuthResult, AuthSessionState } from "../src/types.ts";
import { MemoryRepository } from "./memory-repo.ts";

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
});
