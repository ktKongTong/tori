import { afterEach, describe, expect, it, vi } from "vite-plus/test";

const getWebCookiesMock = vi.fn();

vi.mock("steam-session", () => {
  class LoginSession {
    refreshToken?: string;

    constructor(_platformType: number) {}

    async getWebCookies() {
      return getWebCookiesMock();
    }
  }

  return {
    EAuthTokenPlatformType: {
      WebBrowser: 2,
    },
    LoginSession,
  };
});

describe("SteamProvider", () => {
  afterEach(() => {
    vi.restoreAllMocks();
    getWebCookiesMock.mockReset();
  });

  it("refreshes via steam-session web cookies instead of GenerateAccessTokenForApp", async () => {
    getWebCookiesMock.mockResolvedValue([
      "steamLoginSecure=76561198000000000%7C%7Cmock-web-access-token; Path=/; Secure",
    ]);

    const { SteamProvider } = await import("../src/provider/steam.ts");
    const provider = new SteamProvider();
    const result = await provider.refreshToken("mock-refresh-token");

    expect(result.accessToken).toBe("mock-web-access-token");
    expect(getWebCookiesMock).toHaveBeenCalledTimes(1);
  });

  it("derives a web access token during pollAuth when Steam omits access_token", async () => {
    getWebCookiesMock.mockResolvedValue([
      "steamLoginSecure=76561198000000000%7C%7Cderived-access-token; Path=/; Secure",
    ]);

    const fetchMock = vi.fn().mockResolvedValue({
      status: 200,
      ok: true,
      json: async () => ({
        response: {
          refresh_token:
            "eyJhbGciOiAiRWREU0EiLCAidHlwIjogIkpXVCJ9.eyJzdWIiOiAiNzY1NjExOTgwMDAwMDAwMCIsICJhdWQiOiBbImRlcml2ZSIsICJ3ZWIiXX0.signature",
          account_name: "mock-user",
        },
      }),
    });
    vi.stubGlobal("fetch", fetchMock);

    const { SteamProvider } = await import("../src/provider/steam.ts");
    const provider = new SteamProvider();
    const result = await provider.pollAuth({
      providerName: "steam",
      flowType: "poll",
      challengeData: {
        clientId: "1",
        requestId: "2",
      },
      expiresAt: Date.now() + 60_000,
    });

    expect(result.result?.accessToken).toBe("derived-access-token");
    expect(result.result?.displayName).toBe("mock-user");
    expect(getWebCookiesMock).toHaveBeenCalledTimes(1);
  });
});
