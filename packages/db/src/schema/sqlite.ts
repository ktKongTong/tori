import { integer } from "drizzle-orm/sqlite-core";

export function timestampMs(name: string) {
  return integer(name, { mode: "timestamp_ms" }).notNull();
}

export function timestampSeconds(name: string) {
  return integer(name, { mode: "timestamp" }).notNull();
}

export function booleanInt(name: string) {
  return integer(name, { mode: "boolean" });
}

export function createdAt(name = "created_at") {
  return integer(name, { mode: "timestamp_ms" })
    .notNull()
    .$defaultFn(() => new Date());
}

export function updatedAt(name = "updated_at") {
  return integer(name, { mode: "timestamp_ms" })
    .notNull()
    .$defaultFn(() => new Date())
    .$onUpdateFn(() => new Date());
}

export function accessedAt(name = "access_at") {
  return integer(name, { mode: "timestamp_ms" })
    .notNull()
    .$defaultFn(() => new Date());
}

export const commonTimeFields = {
  createdAt: createdAt(),
  updatedAt: updatedAt(),
};
