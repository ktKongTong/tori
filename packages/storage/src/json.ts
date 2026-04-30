import type { ObjectStore } from "./object-store.ts";

export async function putJson<T>(store: ObjectStore, key: string, value: T) {
  await store.put({
    key,
    body: JSON.stringify(value),
    contentType: "application/json",
  });
}

export async function getJson<T>(store: ObjectStore, key: string): Promise<T | undefined> {
  const object = await store.get(key);
  if (!object?.body) return undefined;
  const text = await new Response(object.body).text();
  return JSON.parse(text) as T;
}

export function toJsonLines<T>(items: readonly T[]) {
  return items.map((item) => JSON.stringify(item)).join("\n");
}

export function parseJsonLines<T>(input: string): T[] {
  return input
    .split("\n")
    .filter(Boolean)
    .map((line) => JSON.parse(line) as T);
}
