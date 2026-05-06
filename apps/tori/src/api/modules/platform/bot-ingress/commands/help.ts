import { z } from "zod";
import { defineBotCommand } from "../registry.js";
import { botCommandRegistry } from "../registry.js";

const helpStateSchema = z.object({
  commands: z.array(z.string()),
});

export const helpCommand = defineBotCommand({
  name: "help",
  action: "help",
  stateSchema: helpStateSchema,
  handler: async () => ({
    commands: botCommandRegistry.listNames().map((command) => `/${command}`),
  }),
});
