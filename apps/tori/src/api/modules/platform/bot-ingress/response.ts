import { z } from "zod";

import type { BotCommandContextSnapshot } from "./type.js";
import { botCommandContextSnapshotSchema } from "./type.js";
export const botCommandResponseSchema = z.object({
  action: z.string(),
  context: botCommandContextSnapshotSchema,
  state: z.unknown(),
});

export type BotCommandResponse = {
  action: string;
  context: BotCommandContextSnapshot;
  state: unknown;
};
