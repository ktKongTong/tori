import type { MessageContextInput } from "../type.js";

export type SubscriptionOwnerType = "USER" | "CHANNEL";

export function parseCommandOptions(commandParams: string[]) {
  const args: string[] = [];
  const options = new Map<string, string>();

  for (const token of commandParams) {
    const separatorIndex = token.indexOf("=");
    if (separatorIndex <= 0) {
      args.push(token);
      continue;
    }

    const key = token.slice(0, separatorIndex).trim().toLowerCase();
    const value = token.slice(separatorIndex + 1).trim();
    if (!key || !value) {
      args.push(token);
      continue;
    }

    options.set(key, value);
  }

  return { args, options };
}

export function resolveDefaultOwnerType(messageContext: MessageContextInput) {
  return (messageContext.channelType === "dm" ? "USER" : "CHANNEL") as SubscriptionOwnerType;
}

export function normalizeOwnerType(value: string | undefined | null): SubscriptionOwnerType | null {
  if (!value) return null;

  switch (value.trim().toLowerCase()) {
    case "user":
      return "USER";
    case "channel":
      return "CHANNEL";
    default:
      return null;
  }
}

export function normalizeSteamFamilyEvent(value: string | undefined | null) {
  if (!value) return "family.library.updated";

  switch (value.trim().toLowerCase()) {
    case "*":
      return "*";
    case "library.updated":
    case "family.library.updated":
      return "family.library.updated";
    default:
      return null;
  }
}
