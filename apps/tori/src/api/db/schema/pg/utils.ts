import { type AnyColumn, type GetColumnData, SQL, sql } from "drizzle-orm";
import { timestamp } from "drizzle-orm/pg-core";

export const aliasedColumn = <T extends AnyColumn>(
  column: T,
  alias: string,
): SQL.Aliased<GetColumnData<T>> => {
  return column
    .getSQL()
    .mapWith((value) => column.mapFromDriverValue(value))
    .as(alias);
};

export const timestamptz = (name: string, withTZ = false) =>
  timestamp(name, { withTimezone: withTZ }).defaultNow();

export const createdAt = (name: string = "created_at", withTZ = false) =>
  timestamp(name, { withTimezone: withTZ }).defaultNow().notNull();
export const updatedAt = (name: string = "updated_at", withTZ = false) =>
  timestamp(name, { withTimezone: withTZ })
    .defaultNow()
    .notNull()
    .$onUpdateFn(() => new Date());
export const accessedAt = (name: string = "access_at", withTZ = false) =>
  timestamp(name, { withTimezone: withTZ }).defaultNow().notNull();

export const commonTimeFields = {
  createdAt: createdAt(),
  updatedAt: updatedAt(),
};
export const requiredTimestamptz = (name: string) => timestamptz(name).notNull();
export const timestamps = {
  createdAt: requiredTimestamptz("created_at").defaultNow(),
  updatedAt: requiredTimestamptz("updated_at")
    .defaultNow()
    .$onUpdate(() => sql`CURRENT_TIMESTAMP`),
};
