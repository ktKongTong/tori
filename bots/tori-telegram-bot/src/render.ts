import type { NotificationBody, NotificationBodyBlock, ToriBotCommandResponse } from "./types.js";

function asRecord(value: unknown): Record<string, unknown> {
  return value && typeof value === "object" ? (value as Record<string, unknown>) : {};
}

function asStringArray(value: unknown) {
  return Array.isArray(value)
    ? value.filter((item): item is string => typeof item === "string")
    : [];
}

function asText(value: unknown, fallback = "") {
  return typeof value === "string" || typeof value === "number" || typeof value === "boolean"
    ? String(value)
    : fallback;
}

function describeSubscriptionTarget(provider: string, resource: string) {
  if (provider === "steam" && resource === "family") return "Steam Family";
  return `${provider} ${resource}`.trim();
}

function describeSubscriptionScope(ownerType: string) {
  return ownerType === "USER"
    ? "Scope: personal subscription in the current chat."
    : "Scope: chat-wide subscription.";
}

function describeSubscriptionEvents(eventTypes: string[]) {
  if (eventTypes.includes("*")) return "Events: all updates.";
  if (eventTypes.every((eventType) => eventType === "family.library.updated")) {
    return "Events: library updates.";
  }
  return `Events: ${eventTypes.join(", ")}`;
}

function renderSubscriptionProblem(action: string, state: Record<string, unknown>) {
  const provider = asText(state.provider);
  const resource = asText(state.resource);
  const owner = asText(state.owner);
  const event = asText(state.event);

  switch (state.kind) {
    case "invalid-target":
      return `Unsupported subscription target: ${provider || "missing"} ${resource || "missing"}`;
    case "invalid-owner":
      return `Unsupported owner for /${action}: ${owner}`;
    case "invalid-event":
      return `Unsupported event for /${action}: ${event}`;
    case "unavailable":
      return `No active ${provider} connection is associated with the resolved user.`;
    case "requires-token-connection":
      return `${describeSubscriptionTarget(provider, resource)} subscription requires a token-backed ${provider} connection configured on web.`;
    default:
      return null;
  }
}

function renderSubscriptionApplied(state: Record<string, unknown>) {
  const provider = asText(state.provider);
  const resource = asText(state.resource);
  const eventTypes = asStringArray(state.eventTypes);
  const ownerType = asText(state.ownerType);
  const target = describeSubscriptionTarget(provider, resource);

  switch (state.operation) {
    case "created":
      return [
        `${target} subscription enabled.`,
        describeSubscriptionScope(ownerType),
        describeSubscriptionEvents(eventTypes),
      ].join("\n");
    case "reactivated":
      return [
        `${target} subscription re-enabled.`,
        describeSubscriptionScope(ownerType),
        describeSubscriptionEvents(eventTypes),
      ].join("\n");
    case "already-active":
      return [
        `${target} subscription is already active.`,
        describeSubscriptionScope(ownerType),
        describeSubscriptionEvents(eventTypes),
      ].join("\n");
    default:
      return null;
  }
}

function renderSubscriptionDisabled(state: Record<string, unknown>) {
  const provider = asText(state.provider);
  const resource = asText(state.resource);
  const eventTypes = asStringArray(state.eventTypes);
  const ownerType = asText(state.ownerType);
  const target = describeSubscriptionTarget(provider, resource);

  if (state.kind === "not-found") {
    return `No active ${target} subscription was found for this target.`;
  }

  switch (state.operation) {
    case "disabled":
      return [
        `${target} subscription disabled.`,
        describeSubscriptionScope(ownerType),
        describeSubscriptionEvents(eventTypes),
      ].join("\n");
    case "already-disabled":
      return [
        `${target} subscription is already disabled.`,
        describeSubscriptionScope(ownerType),
        describeSubscriptionEvents(eventTypes),
      ].join("\n");
    default:
      return null;
  }
}

export function renderToriBotResponse(response: ToriBotCommandResponse) {
  const state = asRecord(response.state);

  switch (response.action) {
    case "unsupported-command":
      return [
        `Unsupported command: ${asText(state.commandName)}`,
        "Available commands:",
        ...asStringArray(state.supportedCommands).map((command) => `/${command}`),
      ].join("\n");
    case "help":
      return ["Available commands:", ...asStringArray(state.commands)].join("\n");
    case "status":
      return [
        `Identity: ${asText(state.identity, "unknown")}`,
        `User binding: ${asText(state.userBindingId, "none")}`,
        `Channel binding: ${asText(state.channelBindingId, "none")}`,
        `Connection: ${state.connection ? JSON.stringify(state.connection) : "not connected"}`,
        `Active subscriptions: ${asText(state.activeSubscriptionCount, "0")}`,
      ].join("\n");
    case "claim-issued":
      return [
        state.replacedPendingClaimSessionId
          ? "Existing pending claim was replaced with a fresh token."
          : "Claim flow started for the current anonymous user.",
        "Redeem this token on the web to complete the claim.",
        `Code: ${asText(state.code)}`,
        `Token: ${asText(state.token)}`,
      ].join("\n");
    case "binding-applied":
      return "Binding token consumed and the current context is now attached to the target binding.";
    case "connection-connected":
      switch (state.kind) {
        case "invalid-provider":
          return `Unsupported provider for /connect: ${asText(state.provider, "missing")}`;
        case "invalid-mode":
          return `Unsupported /connect mode for ${asText(state.provider, "missing")}: ${asText(state.mode, "missing")}\nUse /connect steam id <steamid-or-vanity>.`;
        case "invalid-identifier":
          return `Invalid Steam identity: ${asText(state.identifier, "missing")}\nUse /connect steam id <steamid-or-vanity>.`;
        case "connected":
          return [
            `Steam public-id connection ${state.created ? "created" : "reused"}.`,
            `Identity: ${asText(state.providerAccountId)}`,
            `Access: ${asText(state.accessMode)}`,
            "Token-backed Steam connection is only available on web.",
          ].join("\n");
        default:
          return JSON.stringify(response, null, 2);
      }
    case "subscription-applied": {
      const problem = renderSubscriptionProblem("sub", state);
      return problem ?? renderSubscriptionApplied(state) ?? JSON.stringify(response, null, 2);
    }
    case "subscription-disabled": {
      const problem = renderSubscriptionProblem("unsub", state);
      return problem ?? renderSubscriptionDisabled(state) ?? JSON.stringify(response, null, 2);
    }
    default:
      return JSON.stringify(response, null, 2);
  }
}

function renderNotificationBlock(block: NotificationBodyBlock) {
  switch (block.type) {
    case "heading":
      return block.text;
    case "text":
      return block.text;
    case "stats":
      return block.items.map((item) => `${item.label}: ${item.value}`).join("\n");
    case "list":
      return block.items
        .map((item, index) => (block.style === "ordered" ? `${index + 1}. ${item}` : `- ${item}`))
        .join("\n");
    case "game-grid":
      return [
        block.title ?? null,
        ...block.items.map((item) =>
          [item.title, item.subtitle, item.imageUrl].filter(Boolean).join("\n"),
        ),
      ]
        .filter(Boolean)
        .join("\n\n");
    case "image":
      return [block.caption ?? block.alt ?? "Image", block.url].filter(Boolean).join("\n");
    case "audio":
      return [block.title ?? "Audio", block.url].filter(Boolean).join("\n");
  }
}

export function renderNotificationBody(input: { title?: string | null; body: NotificationBody }) {
  return [
    input.title?.trim() ? input.title.trim() : null,
    ...input.body.blocks.map(renderNotificationBlock),
  ]
    .filter((part): part is string => Boolean(part?.trim()))
    .join("\n\n");
}
