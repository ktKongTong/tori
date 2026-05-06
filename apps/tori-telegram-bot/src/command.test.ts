import { describe, expect, test } from "vite-plus/test";
import { createToriCommandRequest, parseTelegramCommand } from "./command.js";
import type { TelegramMessage } from "./types.js";

describe("parseTelegramCommand", () => {
  test("parses slash command params and strips bot mention", () => {
    expect(parseTelegramCommand("/sub@ToriBot steam family owner=channel")).toEqual({
      commandName: "sub",
      commandParams: ["steam", "family", "owner=channel"],
    });
  });

  test("maps Telegram start to backend help", () => {
    expect(parseTelegramCommand("/start")).toEqual({
      commandName: "help",
      commandParams: [],
    });
  });

  test("ignores non-command text", () => {
    expect(parseTelegramCommand("status")).toBeNull();
  });
});

describe("createToriCommandRequest", () => {
  test("maps Telegram private chat to managed bot-ingress message context", () => {
    const message: TelegramMessage = {
      message_id: 10,
      text: "/status",
      date: 1_778_000_000,
      from: {
        id: 42,
        first_name: "Tori",
        username: "tori_user",
      },
      chat: {
        id: 42,
        type: "private",
        first_name: "Tori",
        username: "tori_user",
      },
    };

    expect(
      createToriCommandRequest({
        message,
        parsed: { commandName: "status", commandParams: [] },
        platform: "telegram",
        namespace: "managed",
      }),
    ).toEqual({
      commandName: "status",
      commandParams: [],
      messageContext: {
        platform: "telegram",
        namespace: "managed",
        observedUserId: "42",
        observedUserName: "@tori_user",
        observedChannelId: "42",
        observedChannelName: "@tori_user",
        channelName: "@tori_user",
        channelType: "dm",
        rawPayload: {
          telegramMessageId: 10,
          telegramChatType: "private",
          telegramDate: 1_778_000_000,
        },
      },
    });
  });
});
