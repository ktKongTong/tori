import { EAuthTokenPlatformType, LoginSession } from "steam-session";
import type { AuthResult, AuthSessionState } from "../types.ts";
import type { PollResult, Provider } from "./types.ts";

const API_BASE = "https://api.steampowered.com";

const SteamAuthTokenPlatformType = {
  UNKNOWN: "0",
  STEAM_CLIENT: "1",
  WEB_BROWSER: "2",
  MOBILE_APP: "3",
};

export class SteamProvider implements Provider {
  name = "steam";
  displayName = "Steam";
  flow = "poll" as const;
  tokenInjectMethod = "query:access_token";
  refreshPolicy = {
    intervalSec: 6 * 60 * 60,
  };

  async beginAuth(_params: Record<string, unknown>) {
    const resp = await fetch(`${API_BASE}/IAuthenticationService/BeginAuthSessionViaQR/v1/`, {
      method: "POST",
      headers: { "Content-Type": "application/x-www-form-urlencoded" },
      body: new URLSearchParams({
        device_friendly_name: "Windows",
        platform_type: SteamAuthTokenPlatformType.WEB_BROWSER,
      }),
    });

    if (!resp.ok) {
      throw new Error(`Steam BeginAuth failed: ${resp.status}`);
    }

    const data = (await resp.json()) as {
      response: {
        client_id: string;
        request_id: string;
        challenge_url: string;
        interval: number;
      };
    };

    const r = data.response;
    return {
      challengeData: {
        clientId: r.client_id,
        requestId: r.request_id,
        qrUrl: r.challenge_url,
        interval: r.interval || 5,
      },
    };
  }

  async pollAuth(session: AuthSessionState): Promise<PollResult> {
    const { clientId, requestId } = session.challengeData as {
      clientId: string;
      requestId: string;
    };

    const resp = await fetch(`${API_BASE}/IAuthenticationService/PollAuthSessionStatus/v1/`, {
      method: "POST",
      headers: { "Content-Type": "application/x-www-form-urlencoded" },
      body: new URLSearchParams({
        client_id: clientId,
        request_id: requestId,
      }),
    });

    // Steam returns non-200 when session expired/denied
    if (resp.status === 400) return { error: "auth session expired or invalid" };
    if (resp.status === 401) return { error: "auth denied by user" };
    if (resp.status === 429) return { error: "rate limited by Steam" };
    if (resp.status >= 500) return { error: `steam server error: ${resp.status}` };
    if (!resp.ok) return { error: `unexpected steam response: ${resp.status}` };

    const data = (await resp.json()) as {
      response: {
        refresh_token?: string;
        access_token?: string;
        account_name?: string;
        new_challenge_url?: string;
        had_remote_interaction?: boolean;
      };
    };

    const r = data.response;

    if (r.refresh_token) {
      const accessToken =
        r.access_token || (await deriveWebAccessTokenFromRefreshToken(r.refresh_token));

      return {
        result: {
          providerUid: extractSteamIdFromJwt(r.refresh_token),
          displayName: r.account_name || "",
          accessToken,
          refreshToken: r.refresh_token,
        },
      };
    }

    if (r.new_challenge_url) {
      return {
        updatedChallenge: { qrUrl: r.new_challenge_url },
      };
    }

    return {}; // still pending
  }

  async callbackAuth(): Promise<AuthResult> {
    throw new Error("steam does not support callback auth, use poll");
  }

  async refreshToken(
    refreshToken: string,
  ): Promise<{ accessToken: string; refreshToken?: string }> {
    return {
      accessToken: await deriveWebAccessTokenFromRefreshToken(refreshToken),
    };
  }
}

async function deriveWebAccessTokenFromRefreshToken(refreshToken: string) {
  const session = new LoginSession(EAuthTokenPlatformType.WebBrowser);
  session.refreshToken = refreshToken;

  const cookies = await session.getWebCookies();
  const steamLoginSecure = cookies.find((cookie) => cookie.startsWith("steamLoginSecure="));
  if (!steamLoginSecure) {
    throw new Error("steamLoginSecure cookie missing from Steam web session");
  }

  const encodedValue = steamLoginSecure.split(";")[0]?.split("=")[1];
  if (!encodedValue) {
    throw new Error("steamLoginSecure cookie is malformed");
  }

  const decodedValue = decodeURIComponent(encodedValue);
  const [, accessToken] = decodedValue.split("||");
  if (!accessToken) {
    throw new Error("Steam web access token missing from steamLoginSecure cookie");
  }

  return accessToken;
}

function extractSteamIdFromJwt(jwt: string): string {
  try {
    const payload = JSON.parse(atob(jwt.split(".")[1]));
    return payload.sub || "";
  } catch {
    return "";
  }
}
