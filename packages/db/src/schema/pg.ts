import type { AnyColumn, GetColumnData, SQL } from "drizzle-orm";
import { timestamp } from "drizzle-orm/pg-core";

export function aliasedColumn<T extends AnyColumn>(
  column: T,
  alias: string,
): SQL.Aliased<GetColumnData<T>> {
  return column
    .getSQL()
    .mapWith((value) => column.mapFromDriverValue(value))
    .as(alias);
}

export function timestamptz(name: string, withTZ = false) {
  return timestamp(name, { withTimezone: withTZ }).defaultNow().notNull();
}

export function createdAt(name = "created_at", withTZ = false) {
  return timestamp(name, { withTimezone: withTZ }).defaultNow().notNull();
}

export function updatedAt(name = "updated_at", withTZ = false) {
  return timestamp(name, { withTimezone: withTZ })
    .defaultNow()
    .notNull()
    .$onUpdateFn(() => new Date());
}

export function accessedAt(name = "access_at", withTZ = false) {
  return timestamp(name, { withTimezone: withTZ }).defaultNow().notNull();
}

export const commonTimeFields = {
  createdAt: createdAt(),
  updatedAt: updatedAt(),
};
