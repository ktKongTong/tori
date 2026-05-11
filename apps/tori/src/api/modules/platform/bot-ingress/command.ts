import type { ServiceContext } from "@/api/domain/infra/service-context.ts";
import type { ManagedBotPluginInstance } from "@/api/modules/platform/bot-plugin/instance.ts";
import { coreBotCommandDefinitions } from "./commands/index.js";
import { resolveOrCreateContext } from "./context.js";
import type { AnyBotCommandDefinition } from "./registry.js";
import { botCommandRegistry } from "./registry.js";
import type { BotCommandResponse } from "./response.js";
import type { BotCommandContextSnapshot, CommandRequestInput } from "./type.js";

let registered = false;

function registerCoreBotCommands() {
  if (registered) return;
  botCommandRegistry.register(...coreBotCommandDefinitions);
  registered = true;
}

export function registerBotCommandDefinitions(...definitions: AnyBotCommandDefinition[]) {
  registerCoreBotCommands();
  botCommandRegistry.register(...definitions);
}

function serializeResolvedContext(context: Awaited<ReturnType<typeof resolveOrCreateContext>>) {
  return {
    userId: context.userBinding?.userId ?? null,
    channelId: context.channelBinding.channelId,
    anonymousUserId: context.anonymousUser?.id ?? null,
    userBindingId: context.userBinding?.id ?? null,
    channelBindingId: context.channelBinding.id,
    namespace: context.namespace,
  };
}

function attachContext<TDefinition extends AnyBotCommandDefinition>(
  definition: TDefinition,
  state: Awaited<ReturnType<TDefinition["handler"]>>,
  context: BotCommandContextSnapshot,
): BotCommandResponse {
  return {
    action: definition.action,
    context,
    state,
  } as BotCommandResponse;
}

function createUnsupportedCommandResponse(
  context: BotCommandContextSnapshot,
  commandName: string,
  supportedCommands: string[],
): BotCommandResponse {
  return {
    action: "unsupported-command",
    context,
    state: {
      commandName,
      supportedCommands,
    },
  };
}

type HandleBotPluginCommandRequestOptions = {
  botPluginInstance?: ManagedBotPluginInstance | null;
};

export async function handleBotPluginCommandRequest(
  ctx: ServiceContext,
  input: CommandRequestInput,
  options: HandleBotPluginCommandRequestOptions = {},
): Promise<BotCommandResponse> {
  registerCoreBotCommands();
  console.log("haha");
  const context = await resolveOrCreateContext(ctx, input.messageContext, options);
  const rawTokens = [input.commandName, ...input.commandParams].filter(Boolean);
  const resolved = botCommandRegistry.resolve(rawTokens);

  console.log("haha2");
  if (!resolved) {
    return createUnsupportedCommandResponse(
      serializeResolvedContext(context),
      rawTokens.join(" "),
      botCommandRegistry.listNames(),
    );
  }

  const { definition, consumedCount } = resolved;
  const rewrittenInput: CommandRequestInput = {
    ...input,
    commandName: definition.name,
    commandParams: rawTokens.slice(consumedCount),
  };

  const state = await definition.handler(ctx, rewrittenInput, context);
  const responseContext = definition.refreshContextAfterHandle
    ? await resolveOrCreateContext(ctx, input.messageContext, options)
    : context;

  console.log("haha3");
  return attachContext(definition, state, serializeResolvedContext(responseContext));
}
