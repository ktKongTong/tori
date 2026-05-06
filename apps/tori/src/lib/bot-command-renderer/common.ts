import type { BotCommandResponse as BotIngressResponse } from "@/api/modules/platform/bot-ingress/response";

function describeSubscriptionTarget(provider: string, resource: string) {
  if (provider === "steam" && resource === "family") {
    return "Steam Family";
  }

  return `${provider} ${resource}`.trim();
}

function describeSubscriptionScope(ownerType: "USER" | "CHANNEL") {
  return ownerType === "USER"
    ? "Scope: personal subscription in the current chat."
    : "Scope: chat-wide subscription.";
}

function describeSubscriptionEvents(eventTypes: string[]) {
  if (eventTypes.includes("*")) {
    return "Events: all updates.";
  }
  if (eventTypes.every((eventType) => eventType === "family.library.updated")) {
    return "Events: library updates.";
  }

  return `Events: ${eventTypes.join(", ")}`;
}

export function renderCommonBotResult(response: BotIngressResponse) {
  switch (response.action) {
    case "unsupported-command": {
      const state = response.state as {
        commandName: string;
        supportedCommands: string[];
      };
      return [
        `Unsupported command: ${state.commandName}`,
        "Available commands:",
        ...state.supportedCommands.map((command) => `/${command}`),
      ].join("\n");
    }
    case "help":
      return ["Available commands:", ...(response.state as { commands: string[] }).commands].join(
        "\n",
      );
    case "status": {
      const state = response.state as {
        identity: string;
        userBindingId: string | null;
        channelBindingId: string | null;
        connection: { provider: string; accessMode: string } | null;
        activeSubscriptionCount: number;
        pendingClaimSessionId: string | null;
      };
      return [
        `Identity: ${state.identity}`,
        `User binding: ${state.userBindingId}`,
        `Channel binding: ${state.channelBindingId}`,
        `Connection: ${state.connection ? `${state.connection.provider}/${state.connection.accessMode}` : "not connected"}`,
        `Active subscriptions: ${state.activeSubscriptionCount}`,
        state.identity === "anonymous"
          ? `Pending claim session: ${state.pendingClaimSessionId ?? "none"}`
          : null,
      ]
        .filter(Boolean)
        .join("\n");
    }
    case "connection-connected": {
      const state = response.state as
        | { kind: "invalid-provider"; provider: string }
        | { kind: "invalid-mode"; provider: string; mode: string }
        | { kind: "invalid-identifier"; provider: string; identifier: string }
        | {
            kind: "connected";
            created: boolean;
            providerAccountId: string;
            accessMode: string;
          };
      if (state.kind === "invalid-provider") {
        return `Unsupported provider for /connect: ${state.provider || "missing"}`;
      }
      if (state.kind === "invalid-mode") {
        return `Unsupported /connect mode for ${state.provider || "missing"}: ${state.mode || "missing"}\nUse \`/connect steam id <steamid-or-vanity>\`.`;
      }
      if (state.kind === "invalid-identifier") {
        return `Invalid Steam identity: ${state.identifier || "missing"}\nUse \`/connect steam id <steamid-or-vanity>\`.`;
      }

      return [
        `Steam public-id connection ${state.created ? "created" : "reused"}.`,
        `Identity: ${state.providerAccountId}`,
        `Access: ${state.accessMode}`,
        "Token-backed Steam connection is only available on web.",
      ].join("\n");
    }
    case "subscription-applied": {
      const state = response.state as
        | { kind: "invalid-target"; provider: string; resource: string }
        | { kind: "invalid-owner"; owner: string }
        | { kind: "invalid-event"; event: string }
        | { kind: "unavailable"; provider: string }
        | { kind: "requires-token-connection"; provider: string; resource: string }
        | {
            kind: "applied";
            operation: "created" | "reactivated" | "already-active";
            provider: string;
            resource: string;
            ownerType: "USER" | "CHANNEL";
            eventTypes: string[];
            topicType: string;
            subscriptionId: string;
            connectionId: string;
          };
      switch (state.kind) {
        case "invalid-target":
          return `Unsupported subscription target: ${state.provider || "missing"} ${state.resource || "missing"}`;
        case "invalid-owner":
          return `Unsupported owner for /sub: ${state.owner}`;
        case "invalid-event":
          return `Unsupported event for /sub: ${state.event}`;
        case "unavailable":
          return `No active ${state.provider} connection is associated with the resolved user.`;
        case "requires-token-connection":
          return `${describeSubscriptionTarget(state.provider, state.resource)} subscription requires a token-backed ${state.provider} connection configured on web.`;
        case "applied":
          switch (state.operation) {
            case "created":
              return [
                `${describeSubscriptionTarget(state.provider, state.resource)} subscription enabled.`,
                describeSubscriptionScope(state.ownerType),
                describeSubscriptionEvents(state.eventTypes),
              ].join("\n");
            case "reactivated":
              return [
                `${describeSubscriptionTarget(state.provider, state.resource)} subscription re-enabled.`,
                describeSubscriptionScope(state.ownerType),
                describeSubscriptionEvents(state.eventTypes),
              ].join("\n");
            case "already-active":
              return [
                `${describeSubscriptionTarget(state.provider, state.resource)} subscription is already active.`,
                describeSubscriptionScope(state.ownerType),
                describeSubscriptionEvents(state.eventTypes),
              ].join("\n");
          }
      }
      return null;
    }
    case "subscription-disabled": {
      const state = response.state as
        | { kind: "invalid-target"; provider: string; resource: string }
        | { kind: "invalid-owner"; owner: string }
        | { kind: "invalid-event"; event: string }
        | { kind: "unavailable"; provider: string }
        | { kind: "requires-token-connection"; provider: string; resource: string }
        | {
            kind: "not-found";
            provider: string;
            resource: string;
            ownerType: "USER" | "CHANNEL";
            eventTypes: string[];
          }
        | {
            kind: "disabled";
            operation: "disabled" | "already-disabled";
            provider: string;
            resource: string;
            ownerType: "USER" | "CHANNEL";
            eventTypes: string[];
            subscriptionId: string;
            connectionId: string;
          };
      switch (state.kind) {
        case "invalid-target":
          return `Unsupported subscription target: ${state.provider || "missing"} ${state.resource || "missing"}`;
        case "invalid-owner":
          return `Unsupported owner for /unsub: ${state.owner}`;
        case "invalid-event":
          return `Unsupported event for /unsub: ${state.event}`;
        case "unavailable":
          return `No active ${state.provider} connection is associated with the resolved user.`;
        case "requires-token-connection":
          return `${describeSubscriptionTarget(state.provider, state.resource)} subscription requires a token-backed ${state.provider} connection configured on web.`;
        case "not-found":
          return `No active ${describeSubscriptionTarget(state.provider, state.resource)} subscription was found for this target.`;
        case "disabled":
          switch (state.operation) {
            case "disabled":
              return [
                `${describeSubscriptionTarget(state.provider, state.resource)} subscription disabled.`,
                describeSubscriptionScope(state.ownerType),
                describeSubscriptionEvents(state.eventTypes),
              ].join("\n");
            case "already-disabled":
              return [
                `${describeSubscriptionTarget(state.provider, state.resource)} subscription is already disabled.`,
                describeSubscriptionScope(state.ownerType),
                describeSubscriptionEvents(state.eventTypes),
              ].join("\n");
          }
      }
      return null;
    }
    default:
      return null;
  }
}
