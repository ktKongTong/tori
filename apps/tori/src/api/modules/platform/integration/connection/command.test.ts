import { createMockServiceContext } from "@test/utils/service.ts";
import { describe, expect, it, vi } from "vite-plus/test";
import {
  completeTokenProxyConnectionCallback,
  startTokenProxyConnection,
  updateConnectionStatus,
} from "./command.ts";

const proxyInstance = {
  id: "proxy-1",
  ownerUserId: "user-1",
  provider: "multi",
  name: "Proxy",
  baseUrl: "https://proxy.example.com",
  credentialRef: "client-1",
  status: "active",
  healthStatus: "healthy",
  capabilities: {
    providers: [{ name: "steam", flow: "poll", grantType: "device" }],
  },
  metadata: {
    oauthClient: {
      clientId: "client-1",
      clientSecret: "secret-1",
    },
  },
  lastSeenAt: null,
  createdAt: new Date("2026-05-10T00:00:00Z"),
  updatedAt: new Date("2026-05-10T00:00:00Z"),
};

function createConnectionRepository(overrides: Record<string, unknown> = {}) {
  return {
    createTokenProxyConnectionSession: vi.fn(async (input) => ({
      ...input,
      status: "pending",
      tokenProxyCode: null,
      connectionId: null,
      error: null,
      metadata: input.metadata ?? { codeVerifier: input.codeVerifier },
      completedAt: null,
      createdAt: new Date("2026-05-10T00:00:00Z"),
      updatedAt: new Date("2026-05-10T00:00:00Z"),
    })),
    findTokenProxyConnectionSession: vi.fn(),
    failTokenProxyConnectionSession: vi.fn(),
    completeTokenProxyConnectionSession: vi.fn(),
    findConnectionByOwnerProviderAccountAndAccessMode: vi.fn(),
    createConnection: vi.fn(),
    findActiveConnectionCredential: vi.fn(),
    createConnectionCredential: vi.fn(),
    updateConnectionCredential: vi.fn(),
    updateConnectionStatus: vi.fn(),
    disableActiveConnectionCredentialsByConnectionId: vi.fn(),
    ...overrides,
  };
}

function createContext(
  connectionRepository: ReturnType<typeof createConnectionRepository>,
  subscriptionRepository = {
    disableActiveSubscriptionsByConnectionId: vi.fn(async () => []),
  },
  outboxRepository = {
    insertEvent: vi.fn(),
    batchInsertEvent: vi.fn(),
  },
) {
  return createMockServiceContext({
    repositories: {
      connection: connectionRepository,
      subscription: subscriptionRepository,
      integration: {
        findProxyInstanceForOwner: vi.fn(async () => proxyInstance),
        findVisibleProxyInstance: vi.fn(async () => proxyInstance),
      },
      outbox: outboxRepository,
    },
  });
}

describe("token-proxy connection flow", () => {
  it("updates connection status for the current owner", async () => {
    const updatedConnection = {
      id: "conn-1",
      ownerUserId: "user-1",
      proxyInstanceId: "proxy-1",
      provider: "steam",
      providerAccountId: "76561198000000000",
      providerAccountName: "Steam User",
      providerAccountAvatar: null,
      accessMode: "proxy-token",
      status: "disabled",
      isDefault: false,
      metadata: null,
      connectedAt: new Date("2026-05-10T00:00:00Z"),
      lastSyncedAt: null,
      createdAt: new Date("2026-05-10T00:00:00Z"),
      updatedAt: new Date("2026-05-10T00:00:00Z"),
    };
    const connectionRepository = createConnectionRepository({
      updateConnectionStatus: vi.fn(async () => updatedConnection),
    });
    const subscriptionRepository = {
      disableActiveSubscriptionsByConnectionId: vi.fn(async () => []),
    };
    const insertEvent = vi.fn();
    const ctx = createContext(connectionRepository, subscriptionRepository, {
      insertEvent,
      batchInsertEvent: vi.fn(),
    });

    const result = await updateConnectionStatus(ctx, "conn-1", { status: "disabled" });

    expect(result).toEqual({ id: "conn-1", status: "disabled" });
    expect(connectionRepository.updateConnectionStatus).toHaveBeenCalledWith({
      id: "conn-1",
      ownerUserId: "user-1",
      status: "disabled",
    });
    expect(
      connectionRepository.disableActiveConnectionCredentialsByConnectionId,
    ).toHaveBeenCalledWith("conn-1");
    expect(subscriptionRepository.disableActiveSubscriptionsByConnectionId).not.toHaveBeenCalled();
    expect(insertEvent).toHaveBeenCalledWith(
      expect.objectContaining({
        type: "platform.connection.disabled",
        subject: "connection:conn-1",
        payload: { connectionId: "conn-1" },
      }),
    );
  });

  it("starts a connection session and returns a token-proxy external connect URL", async () => {
    const connectionRepository = createConnectionRepository();
    const ctx = createContext(connectionRepository);

    const result = await startTokenProxyConnection(
      ctx,
      "proxy-1",
      { provider: "steam", accessMode: "proxy-token" },
      "https://tori.example.com",
    );

    expect(result.sessionId).toBeTruthy();
    expect(result.state).toMatch(/^tp_state_/);
    const connectUrl = new URL(result.connectUrl);
    expect(connectUrl.origin).toBe("https://proxy.example.com");
    expect(connectUrl.pathname).toBe("/admin/external-connect");
    expect(connectUrl.searchParams.get("client_id")).toBe("client-1");
    expect(connectUrl.searchParams.get("response_type")).toBe("code");
    expect(connectUrl.searchParams.get("provider")).toBe("steam");
    expect(connectUrl.searchParams.get("sessionId")).toBe(result.sessionId);
    expect(connectUrl.searchParams.get("state")).toBe(result.state);
    expect(connectUrl.searchParams.get("scope")).toBe("proxy,account,steam-family");
    expect(connectUrl.searchParams.get("code_challenge_method")).toBe("S256");
    expect(connectUrl.searchParams.get("code_challenge")).toBeTruthy();

    const callbackUrl = new URL(connectUrl.searchParams.get("redirect_uri") ?? "");
    expect(callbackUrl.origin).toBe("https://tori.example.com");
    expect(callbackUrl.pathname).toBe("/api/integration/connections/token-proxy/callback");
    expect(callbackUrl.searchParams.get("sessionId")).toBe(result.sessionId);
    expect(callbackUrl.searchParams.get("state")).toBe(result.state);
    expect(connectionRepository.createTokenProxyConnectionSession).toHaveBeenCalledWith(
      expect.objectContaining({
        ownerUserId: "user-1",
        proxyInstanceId: "proxy-1",
        provider: "steam",
        accessMode: "proxy-token",
      }),
    );
  });

  it("exchanges callback code and writes connection plus credential", async () => {
    const connection = {
      id: "conn-1",
      ownerUserId: "user-1",
      proxyInstanceId: "proxy-1",
      provider: "steam",
      providerAccountId: "76561198000000000",
      providerAccountName: "Steam User",
      providerAccountAvatar: null,
      accessMode: "proxy-token",
      status: "active",
      isDefault: false,
      metadata: null,
      connectedAt: new Date("2026-05-10T00:00:00Z"),
      lastSyncedAt: null,
      createdAt: new Date("2026-05-10T00:00:00Z"),
      updatedAt: new Date("2026-05-10T00:00:00Z"),
    };
    const connectionRepository = createConnectionRepository({
      findTokenProxyConnectionSession: vi.fn(async () => ({
        id: "session-1",
        state: "state-1",
        ownerUserId: "user-1",
        proxyInstanceId: "proxy-1",
        provider: "steam",
        accessMode: "proxy-token",
        status: "pending",
        callbackUrl: "https://tori.example.com/callback",
        tokenProxyConnectUrl: "https://proxy.example.com/admin/external-connect",
        tokenProxyCode: null,
        connectionId: null,
        error: null,
        metadata: { codeVerifier: "verifier-1" },
        expiresAt: new Date(Date.now() + 60_000),
        completedAt: null,
        createdAt: new Date("2026-05-10T00:00:00Z"),
        updatedAt: new Date("2026-05-10T00:00:00Z"),
      })),
      findConnectionByOwnerProviderAccountAndAccessMode: vi.fn(async () => null),
      createConnection: vi.fn(async () => connection),
      findActiveConnectionCredential: vi.fn(async () => null),
      createConnectionCredential: vi.fn(async (input) => ({
        ...input,
        status: "active",
        lastUsedAt: null,
        expiresAt: null,
        createdAt: new Date("2026-05-10T00:00:00Z"),
        updatedAt: new Date("2026-05-10T00:00:00Z"),
      })),
      completeTokenProxyConnectionSession: vi.fn(async () => null),
    });
    const ctx = createContext(connectionRepository);
    const fetchMock = vi.spyOn(globalThis, "fetch").mockResolvedValue(
      new Response(
        JSON.stringify({
          connection: {
            id: "tp-conn-1",
            provider: "steam",
            providerUid: "76561198000000000",
            name: "Steam User",
            permissions: ["proxy", "account", "steam-family"],
          },
          apiKey: "tp-api-key",
          account: {
            providerAccountId: "76561198000000000",
            providerAccountName: "Steam User",
            providerAccountAvatar: null,
          },
        }),
        { status: 200, headers: { "content-type": "application/json" } },
      ),
    );

    try {
      const result = await completeTokenProxyConnectionCallback(ctx, {
        sessionId: "session-1",
        state: "state-1",
        code: "code-1",
      });

      expect(result.status).toBe("completed");
      expect(connectionRepository.createConnection).toHaveBeenCalledWith(
        expect.objectContaining({
          ownerUserId: "user-1",
          provider: "steam",
          providerAccountId: "76561198000000000",
          accessMode: "proxy-token",
          proxyInstanceId: "proxy-1",
        }),
      );
      expect(connectionRepository.createConnectionCredential).toHaveBeenCalledWith(
        expect.objectContaining({
          connectionId: "conn-1",
          proxyInstanceId: "proxy-1",
          kind: "token-proxy-api-key",
          credentialRef: "tp-api-key",
        }),
      );
      expect(connectionRepository.completeTokenProxyConnectionSession).toHaveBeenCalledWith({
        id: "session-1",
        state: "state-1",
        tokenProxyCode: "code-1",
        connectionId: "conn-1",
      });
      expect(fetchMock.mock.calls[0]?.[0]).toBe("https://proxy.example.com/oauth/token");
      const exchangeRequestBody = fetchMock.mock.calls[0]?.[1]?.body;
      if (!(exchangeRequestBody instanceof URLSearchParams)) {
        throw new Error("Expected URLSearchParams exchange request body");
      }
      expect(exchangeRequestBody.get("grant_type")).toBe("authorization_code");
      expect(exchangeRequestBody.get("client_id")).toBe("client-1");
      expect(exchangeRequestBody.get("client_secret")).toBe("secret-1");
      expect(exchangeRequestBody.get("redirect_uri")).toBe("https://tori.example.com/callback");
      expect(exchangeRequestBody.get("code_verifier")).toBe("verifier-1");
      expect(exchangeRequestBody.get("code")).toBe("code-1");
    } finally {
      fetchMock.mockRestore();
    }
  });

  it("refreshes an existing active credential when the same account reconnects", async () => {
    const connection = {
      id: "conn-1",
      ownerUserId: "user-1",
      proxyInstanceId: "proxy-1",
      provider: "steam",
      providerAccountId: "76561198000000000",
      providerAccountName: "Steam User",
      providerAccountAvatar: null,
      accessMode: "proxy-token",
      status: "active",
      isDefault: false,
      metadata: null,
      connectedAt: new Date("2026-05-10T00:00:00Z"),
      lastSyncedAt: null,
      createdAt: new Date("2026-05-10T00:00:00Z"),
      updatedAt: new Date("2026-05-10T00:00:00Z"),
    };
    const connectionRepository = createConnectionRepository({
      findTokenProxyConnectionSession: vi.fn(async () => ({
        id: "session-1",
        state: "state-1",
        ownerUserId: "user-1",
        proxyInstanceId: "proxy-1",
        provider: "steam",
        accessMode: "proxy-token",
        status: "pending",
        callbackUrl: "https://tori.example.com/callback",
        tokenProxyConnectUrl: "https://proxy.example.com/admin/external-connect",
        tokenProxyCode: null,
        connectionId: null,
        error: null,
        metadata: { codeVerifier: "verifier-1" },
        expiresAt: new Date(Date.now() + 60_000),
        completedAt: null,
        createdAt: new Date("2026-05-10T00:00:00Z"),
        updatedAt: new Date("2026-05-10T00:00:00Z"),
      })),
      findConnectionByOwnerProviderAccountAndAccessMode: vi.fn(async () => connection),
      findActiveConnectionCredential: vi.fn(async () => ({
        id: "credential-1",
        connectionId: "conn-1",
        proxyInstanceId: "proxy-1",
        kind: "token-proxy-api-key",
        credentialRef: "old-key",
        status: "active",
        metadata: null,
        lastUsedAt: null,
        expiresAt: null,
        createdAt: new Date("2026-05-10T00:00:00Z"),
        updatedAt: new Date("2026-05-10T00:00:00Z"),
      })),
      updateConnectionCredential: vi.fn(async (input) => ({
        id: input.id,
        connectionId: "conn-1",
        kind: "token-proxy-api-key",
        status: "active",
        lastUsedAt: null,
        createdAt: new Date("2026-05-10T00:00:00Z"),
        updatedAt: new Date("2026-05-10T00:00:00Z"),
        ...input,
        expiresAt: input.expiresAt ?? null,
      })),
      completeTokenProxyConnectionSession: vi.fn(async () => null),
    });
    const ctx = createContext(connectionRepository);
    const fetchMock = vi.spyOn(globalThis, "fetch").mockResolvedValue(
      new Response(
        JSON.stringify({
          connection: {
            id: "tp-conn-2",
            provider: "steam",
            providerUid: "76561198000000000",
            name: "Steam User",
            permissions: ["proxy", "account", "steam-family"],
          },
          apiKey: "new-tp-api-key",
          account: {
            providerAccountId: "76561198000000000",
            providerAccountName: "Steam User",
            providerAccountAvatar: null,
          },
        }),
        { status: 200, headers: { "content-type": "application/json" } },
      ),
    );

    try {
      const result = await completeTokenProxyConnectionCallback(ctx, {
        sessionId: "session-1",
        state: "state-1",
        code: "code-1",
      });

      expect(result.status).toBe("completed");
      expect(connectionRepository.createConnection).not.toHaveBeenCalled();
      expect(connectionRepository.createConnectionCredential).not.toHaveBeenCalled();
      expect(connectionRepository.updateConnectionCredential).toHaveBeenCalledWith(
        expect.objectContaining({
          id: "credential-1",
          proxyInstanceId: "proxy-1",
          credentialRef: "new-tp-api-key",
        }),
      );
    } finally {
      fetchMock.mockRestore();
    }
  });
});
