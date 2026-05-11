import {
  normalizeOwnerType,
  normalizeSteamFamilyEvent,
  resolveDefaultOwnerType,
} from "@/api/modules/platform/bot-ingress/commands/helpers";
import {
  defineSubscriptionTarget,
  type SubscriptionTargetDefinition,
  type SubscriptionTargetResolution,
} from "@/api/modules/platform/bot-ingress/commands/subscription-targets";

export const steamFamilySubscriptionTarget = defineSubscriptionTarget({
  provider: "steam",
  resource: "family",
  resolve: async (ctx, context, input): Promise<SubscriptionTargetResolution> => {
    const ownerInput = input.options.get("owner");
    const normalizedOwnerType = normalizeOwnerType(ownerInput);
    if (ownerInput && !normalizedOwnerType) {
      return {
        kind: "invalid-owner",
        owner: ownerInput,
      };
    }

    const eventInput = input.options.get("event");
    const normalizedEvent = normalizeSteamFamilyEvent(eventInput);
    if (eventInput && !normalizedEvent) {
      return {
        kind: "invalid-event",
        event: eventInput,
      };
    }

    const connection = await ctx.repositories.connection.findDefaultActiveConnectionForOwner({
      ownerUserId: context.userBinding.userId,
      provider: "steam",
      excludeAccessMode: "public-id",
    });

    if (!connection) {
      return {
        kind: "requires-token-connection",
        provider: "steam",
        resource: "family",
      };
    }

    const ownerType = normalizedOwnerType ?? resolveDefaultOwnerType(input.messageContext);
    const ownerId =
      ownerType === "USER" ? context.userBinding.userId : context.channelBinding.channelId;
    return {
      kind: "applied",
      target: {
        provider: "steam",
        resource: "family",
        channelId: context.channelBinding.channelId,
        connectionId: connection.id,
        ownerType,
        ownerId,
        topicType: "steam.family",
        topicKey: "steam.family",
        eventTypes: [normalizedEvent ?? "family.library.updated"],
      },
    };
  },
});

export const steamFamilySubscriptionTargetDefinitions = [
  steamFamilySubscriptionTarget,
] as const satisfies readonly SubscriptionTargetDefinition[];
