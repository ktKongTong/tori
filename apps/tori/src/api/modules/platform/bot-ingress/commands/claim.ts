import { z } from "zod";
import { findPendingClaimSessionForContext, startClaimForContext } from "../context.js";
import { defineBotCommand } from "../registry.js";

const claimIssuedStateSchema = z.object({
  claimSessionId: z.string(),
  anonymousUserId: z.string().nullable(),
  code: z.string(),
  token: z.string(),
  replacedPendingClaimSessionId: z.string().nullable(),
});

export const claimCommand = defineBotCommand({
  name: "claim",
  action: "claim-issued",
  stateSchema: claimIssuedStateSchema,
  refreshContextAfterHandle: true,
  handler: async (ctx, input, context) => {
    const existingPending = await findPendingClaimSessionForContext(
      ctx,
      input.messageContext,
      context,
    );
    const { issued, claimSession } = await startClaimForContext(ctx, input.messageContext, context);

    return {
      claimSessionId: claimSession.id,
      anonymousUserId: context.anonymousUser?.id ?? null,
      code: issued.grant.code,
      token: issued.plaintextToken,
      replacedPendingClaimSessionId: existingPending?.id ?? null,
    };
  },
});
