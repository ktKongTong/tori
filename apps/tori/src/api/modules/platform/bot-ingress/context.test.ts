import { describe, expect, it } from "vite-plus/test";

import { assertClaimSupportedMessageContext } from "./context.js";
import { messageContextSchema } from "./type.js";

describe("bot-plugin claim command rules", () => {
  it("allows claims in direct messages", () => {
    expect(() =>
      assertClaimSupportedMessageContext({
        platform: "mock",
        observedUserId: "user-1",
        observedUserName: "User One",
        observedChannelId: "channel-1",
        observedChannelName: "Channel One",
        channelName: "Channel One",
        channelType: "dm",
      }),
    ).not.toThrow();
  });

  it("rejects claims outside direct messages", () => {
    expect(() =>
      assertClaimSupportedMessageContext({
        platform: "mock",
        observedUserId: "user-1",
        observedUserName: "User One",
        observedChannelId: "channel-1",
        observedChannelName: "Channel One",
        channelName: "Channel One",
        channelType: "group",
      }),
    ).toThrow("/claim is only available in direct messages.");
  });

  it("rejects message contexts without observed names", () => {
    const result = messageContextSchema.safeParse({
      platform: "mock",
      observedUserId: "user-1",
      observedChannelId: "channel-1",
      channelType: "dm",
      channelName: "Channel One",
    });

    expect(result.success).toBe(false);
  });
});
