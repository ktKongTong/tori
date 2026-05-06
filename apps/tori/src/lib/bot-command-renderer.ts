import { renderBindingBotResult } from "./bot-command-renderer/binding";
import { renderCommonBotResult } from "./bot-command-renderer/common";
import { renderSteamBotResult } from "./bot-command-renderer/steam";

export type { BotCommandResponse as BotIngressResponse } from "@/api/modules/platform/bot-ingress/response";
import type { BotCommandResponse as BotIngressResponse } from "@/api/modules/platform/bot-ingress/response";
export function renderBotResult(response: BotIngressResponse) {
  return (
    renderCommonBotResult(response) ??
    renderBindingBotResult(response) ??
    renderSteamBotResult(response) ??
    JSON.stringify(response, null, 2)
  );
}
