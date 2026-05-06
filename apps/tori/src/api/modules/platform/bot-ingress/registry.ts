import { z } from "zod";
import type { ServiceContext } from "@/api/domain/infra/service-context.ts";

import type { ResolvedBotContext } from "./context.js";
import type { CommandRequestInput } from "./type.js";

export type BotCommandStateSchema = z.ZodTypeAny;

export type BotCommandHandler<TStateSchema extends BotCommandStateSchema> = (
  ctx: ServiceContext,
  input: CommandRequestInput,
  context: ResolvedBotContext,
) => Promise<z.infer<TStateSchema>>;

export type BotCommandDefinition<
  TName extends string = string,
  TAction extends string = string,
  TStateSchema extends BotCommandStateSchema = BotCommandStateSchema,
> = {
  name: TName;
  action: TAction;
  stateSchema: TStateSchema;
  refreshContextAfterHandle?: boolean;
  handler: BotCommandHandler<TStateSchema>;
};

export type AnyBotCommandDefinition = BotCommandDefinition<string, string, BotCommandStateSchema>;

export function defineBotCommand<
  TName extends string,
  TAction extends string,
  TStateSchema extends BotCommandStateSchema,
>(
  definition: BotCommandDefinition<TName, TAction, TStateSchema>,
): BotCommandDefinition<TName, TAction, TStateSchema> {
  return definition;
}

function normalizeCommandPath(path: string) {
  return path
    .trim()
    .split(/\s+/)
    .filter(Boolean)
    .map((part) => part.toLowerCase())
    .join(" ");
}

export class BotCommandRegistry {
  private readonly handlers = new Map<string, AnyBotCommandDefinition>();

  register(...definitions: AnyBotCommandDefinition[]) {
    for (const definition of definitions) {
      const normalizedName = normalizeCommandPath(definition.name);
      if (this.handlers.has(normalizedName)) {
        throw new Error(`Bot command already registered: ${definition.name}`);
      }
      this.handlers.set(normalizedName, definition);
    }
  }

  resolve(tokens: string[]) {
    for (let length = tokens.length; length >= 1; length -= 1) {
      const normalizedName = normalizeCommandPath(tokens.slice(0, length).join(" "));
      const definition = this.handlers.get(normalizedName);
      if (definition) {
        return { definition, consumedCount: length };
      }
    }

    return null;
  }

  listNames() {
    return [...this.handlers.values()].map((definition) => definition.name).sort();
  }
}

export const botCommandRegistry = new BotCommandRegistry();
