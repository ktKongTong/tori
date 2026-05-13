import type { TelegramMessage, ToriCommandRequest } from "./types.js";

export type ParsedTelegramCommand = {
  commandName: string;
  commandParams: string[];
};

function joinNameParts(...parts: Array<string | undefined>) {
  return parts
    .map((part) => part?.trim())
    .filter(Boolean)
    .join(" ");
}

function resolveUserName(message: TelegramMessage) {
  const user = message.from;
  if (!user) return String(message.chat.id);

  return user.username
    ? `@${user.username}`
    : joinNameParts(user.first_name, user.last_name) || String(user.id);
}

function resolveChatName(message: TelegramMessage) {
  return (
    message.chat.title ||
    (message.chat.username ? `@${message.chat.username}` : null) ||
    joinNameParts(message.chat.first_name, message.chat.last_name) ||
    String(message.chat.id)
  );
}

export function parseTelegramCommand(text: string): ParsedTelegramCommand | null {
  const normalized = text.trim();
  if (!normalized.startsWith("/")) return null;

  const [rawCommand = "", ...params] = normalized.slice(1).split(/\s+/).filter(Boolean);
  const commandName = rawCommand.split("@")[0]?.trim().toLowerCase();
  if (!commandName) return null;

  return {
    commandName: commandName === "start" ? "help" : commandName,
    commandParams: params,
  };
}

export function createToriCommandRequest(input: {
  message: TelegramMessage;
  parsed: ParsedTelegramCommand;
  platform: string;
  namespace: string;
}): ToriCommandRequest {
  const { message, parsed } = input;
  const observedUserId = String(message.from?.id ?? message.chat.id);
  const observedChannelId = String(message.chat.id);
  const observedChannelName = resolveChatName(message);

  return {
    commandName: parsed.commandName,
    commandParams: parsed.commandParams,
    messageContext: {
      platform: input.platform,
      namespace: input.namespace,
      observedUserId,
      observedUserName: resolveUserName(message),
      observedChannelId,
      observedChannelName,
      channelName: observedChannelName,
      channelType: message.chat.type === "private" ? "dm" : "channel",
      rawPayload: {
        telegramMessageId: message.message_id,
        telegramChatType: message.chat.type,
        telegramDate: message.date ?? null,
      },
    },
  };
}
