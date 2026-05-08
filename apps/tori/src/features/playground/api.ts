import { createRequestClient } from "@repo/request";

import {
  botCommandResponseSchema,
  type BotCommandResponse,
} from "@/api/modules/platform/bot-ingress/response";
import type { CommandRequestInput } from "@/api/modules/platform/bot-ingress/type";

const botRequest = createRequestClient({
  credentials: "include",
  retry: 0,
  timeout: 10000,
  headers: {
    accept: "application/json",
  },
});

export const sendBotIngressRequest = (input: CommandRequestInput): Promise<BotCommandResponse> =>
  botRequest.post("/api/bot-ingress/request", input, {
    schema: botCommandResponseSchema,
  });
