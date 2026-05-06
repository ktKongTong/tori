import { z } from "zod";
import { consumeBindingGrantForContext, resolveOrCreateContext } from "../context.js";
import { defineBotCommand } from "../registry.js";

const bindingAppliedStateSchema = z.object({
  identity: z.enum(["anonymous", "claimed"]),
});

export const bindCommand = defineBotCommand({
  name: "bind",
  action: "binding-applied",
  stateSchema: bindingAppliedStateSchema,
  refreshContextAfterHandle: true,
  handler: async (ctx, input, context) => {
    const token = input.commandParams.join(" ").trim();
    await consumeBindingGrantForContext(ctx, input.messageContext, context, token);
    const updatedContext = await resolveOrCreateContext(ctx, input.messageContext);
    const identity: "anonymous" | "claimed" = updatedContext.anonymousUser
      ? "anonymous"
      : "claimed";

    return {
      identity,
    };
  },
});
