import yn from "yn";

const BOOLEAN_ALIASES = new Map([
  ["enabled", "true"],
  ["disabled", "false"],
]);

export function parseBoolean(value: unknown, defaultValue = true): boolean {
  if (typeof value === "boolean") return value;
  if (typeof value === "number") return value !== 0;
  if (typeof value !== "string") return defaultValue;
  const normalized = value.trim().toLowerCase();
  return yn(BOOLEAN_ALIASES.get(normalized) ?? normalized, { default: defaultValue });
}
