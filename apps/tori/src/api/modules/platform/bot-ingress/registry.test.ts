import { describe, expect, it } from "vite-plus/test";
import { z } from "zod";

import { BotCommandRegistry, defineBotCommand } from "./registry.js";

describe("BotCommandRegistry", () => {
  it("resolves multi-segment provider commands using the longest matching path", () => {
    const registry = new BotCommandRegistry();
    const root = defineBotCommand({
      name: "steam",
      action: "steam-root",
      stateSchema: z.object({ ok: z.boolean() }),
      handler: async () => ({ ok: true }),
    });
    const familyInfo = defineBotCommand({
      name: "steam family info",
      action: "steam-family-info",
      stateSchema: z.object({ ok: z.boolean() }),
      handler: async () => ({ ok: true }),
    });

    registry.register(root, familyInfo);

    const resolved = registry.resolve(["steam", "family", "info", "portal"]);

    expect(resolved).not.toBeNull();
    expect(resolved?.definition.name).toBe("steam family info");
    expect(resolved?.consumedCount).toBe(3);
  });

  it("lists the registered command paths instead of flattened aliases", () => {
    const registry = new BotCommandRegistry();
    registry.register(
      defineBotCommand({
        name: "help",
        action: "help",
        stateSchema: z.object({ ok: z.boolean() }),
        handler: async () => ({ ok: true }),
      }),
      defineBotCommand({
        name: "steam account profile",
        action: "steam-account-profile",
        stateSchema: z.object({ ok: z.boolean() }),
        handler: async () => ({ ok: true }),
      }),
    );

    expect(registry.listNames()).toEqual(["help", "steam account profile"]);
  });
});
