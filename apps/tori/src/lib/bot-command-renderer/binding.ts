import type { BotCommandResponse as BotIngressResponse } from "@/api/modules/platform/bot-ingress/response";

export function renderBindingBotResult(response: BotIngressResponse) {
  switch (response.action) {
    case "claim-issued": {
      const state = response.state as {
        replacedPendingClaimSessionId: string | null;
        code: string;
        token: string;
      };
      return [
        state.replacedPendingClaimSessionId
          ? "Existing pending claim was replaced with a fresh token."
          : "Claim flow started for the current anonymous user.",
        "Redeem this token on the web to complete the claim.",
        `Code: ${state.code}`,
        `Token: ${state.token}`,
      ].join("\n");
    }
    case "binding-applied": {
      const state = response.state as {
        identity: "anonymous" | "bound";
      };
      return state.identity === "anonymous"
        ? "Binding token consumed, but the context is still anonymous."
        : "Binding token consumed and the current context is now attached to the target binding.";
    }
    default:
      return null;
  }
}
