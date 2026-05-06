import type { BotCommandResponse as BotIngressResponse } from "@/api/modules/platform/bot-ingress/response";

function renderItems(items: Array<{ appId: number; name: string | null }>) {
  return items.slice(0, 10).map((item) => `- ${item.name ?? item.appId}`);
}

export function renderSteamBotResult(response: BotIngressResponse) {
  switch (response.action) {
    case "steam-account-inventory": {
      const state = response.state as
        | { hasConnection: false }
        | {
            hasConnection: true;
            totalCount: number;
            matchedCount: number;
            items: Array<{ appId: number; name: string | null }>;
          };
      if (!state.hasConnection) {
        return "No active connection is associated with the resolved user.";
      }
      return state.items.length > 0
        ? [
            `Inventory matches: ${state.matchedCount} / ${state.totalCount}`,
            ...renderItems(state.items),
          ].join("\n")
        : "No inventory items were found for the resolved connection.";
    }
    case "steam-account-profile": {
      const state = response.state as
        | { hasConnection: false }
        | {
            hasConnection: true;
            personaName: string | null;
            steamId: string;
            profileUrl: string | null;
          };
      return state.hasConnection
        ? [
            `Persona: ${state.personaName ?? "Unknown"}`,
            `SteamID: ${state.steamId}`,
            `Profile: ${state.profileUrl ?? "—"}`,
          ].join("\n")
        : "No active connection is associated with the resolved user.";
    }
    default:
      return null;
  }
}
