export type JsonPrimitive = string | number | boolean | null;
export type JsonValue = JsonPrimitive | JsonObject | JsonArray;
export type JsonObject = { [key: string]: JsonValue | undefined };
export type JsonArray = JsonValue[];
export type JsonRecord = JsonObject;

export function isJsonValue(value: unknown): value is JsonValue {
  if (value === null) return true;
  if (["string", "number", "boolean"].includes(typeof value)) return true;
  if (Array.isArray(value)) return value.every(isJsonValue);
  return isJsonObject(value) && Object.values(value).every(isJsonValue);
}

export function isJsonObject(value: unknown): value is JsonObject {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}
