import { createToriCommandRequest, parseTelegramCommand } from "./command.js";
import { renderNotificationBody, renderToriBotResponse } from "./render.js";
import { sendToriCommandRequest } from "./tori.js";
import type { TelegramBotConfig } from "./config.js";
import type { FetchLike, Logger, TelegramUpdate, ToriNotification } from "./types.js";

type TelegramApiResponse<T> = {
  ok: boolean;
  result?: T;
  description?: string;
};

function telegramApiUrl(token: string, method: string) {
  return `https://api.telegram.org/bot${token}/${method}`;
}

async function callTelegramApi<T>(input: {
  fetchImpl: FetchLike;
  token: string;
  method: string;
  body: Record<string, unknown>;
}) {
  const response = await input.fetchImpl(telegramApiUrl(input.token, input.method), {
    method: "POST",
    headers: {
      "content-type": "application/json",
    },
    body: JSON.stringify(input.body),
  });

  const payload = (await response.json()) as TelegramApiResponse<T>;
  if (!response.ok || !payload.ok) {
    throw new Error(
      payload.description || `Telegram ${input.method} failed with ${response.status}`,
    );
  }

  return payload.result as T;
}

export async function getUpdates(input: {
  fetchImpl: FetchLike;
  token: string;
  offset?: number;
  timeoutSeconds: number;
}) {
  return callTelegramApi<TelegramUpdate[]>({
    fetchImpl: input.fetchImpl,
    token: input.token,
    method: "getUpdates",
    body: {
      offset: input.offset,
      timeout: input.timeoutSeconds,
      allowed_updates: ["message"],
    },
  });
}

export async function sendTelegramMessage(input: {
  fetchImpl: FetchLike;
  token: string;
  chatId: number;
  text: string;
}) {
  const chunks = input.text.match(/[\s\S]{1,3900}/g) ?? [input.text];

  for (const chunk of chunks) {
    await callTelegramApi<unknown>({
      fetchImpl: input.fetchImpl,
      token: input.token,
      method: "sendMessage",
      body: {
        chat_id: input.chatId,
        text: chunk,
        disable_web_page_preview: true,
      },
    });
  }
}

export async function handleTelegramUpdate(input: {
  config: TelegramBotConfig;
  fetchImpl: FetchLike;
  logger: Logger;
  update: TelegramUpdate;
}) {
  const message = input.update.message;
  if (!message?.text) return;

  const parsed = parseTelegramCommand(message.text);
  if (!parsed) return;

  const request = createToriCommandRequest({
    message,
    parsed,
    platform: input.config.platform,
    namespace: input.config.namespace,
  });

  try {
    const response = await sendToriCommandRequest({
      fetchImpl: input.fetchImpl,
      baseUrl: input.config.toriBaseUrl,
      credential: input.config.toriBotPluginCredential,
      request,
    });

    await sendTelegramMessage({
      fetchImpl: input.fetchImpl,
      token: input.config.telegramBotToken,
      chatId: message.chat.id,
      text: renderToriBotResponse(response),
    });
  } catch (error) {
    input.logger.error(error);
    await sendTelegramMessage({
      fetchImpl: input.fetchImpl,
      token: input.config.telegramBotToken,
      chatId: message.chat.id,
      text: error instanceof Error ? error.message : "Tori command failed.",
    });
  }
}

export async function handleToriNotification(input: {
  config: TelegramBotConfig;
  fetchImpl: FetchLike;
  logger: Logger;
  notification: ToriNotification;
}) {
  if (input.notification.platform && input.notification.platform !== input.config.platform) return;
  if (input.notification.namespace && input.notification.namespace !== input.config.namespace)
    return;

  const chatId = Number.parseInt(input.notification.externalChannelId ?? "", 10);
  if (!Number.isFinite(chatId)) {
    input.logger.warn(`Notification ${input.notification.id} has no Telegram chat id`);
    return;
  }

  await sendTelegramMessage({
    fetchImpl: input.fetchImpl,
    token: input.config.telegramBotToken,
    chatId,
    text: renderNotificationBody({
      title: input.notification.title,
      body: input.notification.body,
    }),
  });
}

export async function runTelegramCommandPolling(input: {
  config: TelegramBotConfig;
  fetchImpl: FetchLike;
  logger: Logger;
  signal?: AbortSignal;
}) {
  let offset: number | undefined;

  while (!input.signal?.aborted) {
    try {
      const updates = await getUpdates({
        fetchImpl: input.fetchImpl,
        token: input.config.telegramBotToken,
        offset,
        timeoutSeconds: input.config.pollTimeoutSeconds,
      });

      for (const update of updates) {
        offset = update.update_id + 1;
        await handleTelegramUpdate({
          config: input.config,
          fetchImpl: input.fetchImpl,
          logger: input.logger,
          update,
        });
      }
    } catch (error) {
      input.logger.error(error);
      await new Promise((resolve) => setTimeout(resolve, 1000));
    }
  }
}

export async function runTelegramCommandBot(input: {
  config: TelegramBotConfig;
  fetchImpl?: FetchLike;
  logger?: Logger;
  signal?: AbortSignal;
}) {
  const fetchImpl = input.fetchImpl ?? fetch;
  const logger = input.logger ?? console;

  logger.info(
    `Tori Telegram bot started: platform=${input.config.platform}, namespace=${input.config.namespace}`,
  );

  await runTelegramCommandPolling({
    config: input.config,
    fetchImpl,
    logger,
    signal: input.signal,
  });
}
