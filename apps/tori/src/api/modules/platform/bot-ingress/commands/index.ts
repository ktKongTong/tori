import type { AnyBotCommandDefinition } from "../registry.js";
import { bindCommand } from "./bind.js";
import { claimCommand } from "./claim.js";
import { connectCommand } from "./connect.js";
import { helpCommand } from "./help.js";
import { statusCommand } from "./status.js";
import { subCommand } from "./sub.js";
import { unsubCommand } from "./unsub.js";

export const coreBotCommandDefinitions = [
  helpCommand,
  statusCommand,
  claimCommand,
  bindCommand,
  connectCommand,
  subCommand,
  unsubCommand,
] as const satisfies readonly AnyBotCommandDefinition[];
