import {type AnyPgTable, type PgSelect, PgTable} from "drizzle-orm/pg-core";
import type {AnySQLiteTable} from "drizzle-orm/sqlite-core";
import {asc, desc, getColumns, type InferSelectModel, type SQL} from "drizzle-orm";
import type {DynamicQuery, PageBasedPaginationParam, PageResult} from "./type.ts";
import type {NodePgDatabase} from "drizzle-orm/node-postgres";
import {normalizePage, toPageResult} from "./index.ts";
export type TableKey<T extends AnyPgTable | AnySQLiteTable> =
  Extract<keyof InferSelectModel<T>, string>;

export const dynamicQuery = <

  TQuery extends PgSelect,
  TTable extends AnyPgTable,
>(
  qb: TQuery,
  table: TTable,
  condition: DynamicQuery<TableKey<TTable>>,
): TQuery => {
  const columns = getColumns(table);

  const orderBy =
    condition.orderBy?.length
      ? condition.orderBy
      : condition.defaultOrderBy;

  let nextQb = qb;

  if (orderBy?.length) {
    const orderByExpressions = orderBy.map(({ column, direction }) => {
      const targetColumn = columns[column as keyof typeof columns];

      if (!targetColumn) {
        throw new Error(`Unknown order column: ${String(column)}`);
      }

      return direction === 'desc'
        ? desc(targetColumn)
        : asc(targetColumn);
    });

    nextQb = nextQb.orderBy(...orderByExpressions) as TQuery;
  }

  if (condition.page) {
    const page = Math.max(1, condition.page.page);
    const pageSize = Math.max(1, condition.page.pageSize);
    const offset = (page - 1) * pageSize;

    nextQb = nextQb.limit(pageSize).offset(offset) as TQuery;
  }

  return nextQb;
};

export function withPagination<T extends PgSelect>(
  qb: T, page: {
    page: number,
    pageSize: number,
  }
) {
  return qb.limit(page.pageSize).offset((page.page - 1) * page.pageSize);
}



export async function list<TSchema extends Record<string, unknown>,DB extends NodePgDatabase<TSchema>, TTable extends AnyPgTable>(
  db: DB,
  table: TTable,
  condition: DynamicQuery<TableKey<TTable>> & {
    where?: SQL<unknown>;
  },
): Promise<PageResult<InferSelectModel<TTable>>> {
  const [data, total] = await Promise.all([
    dynamicQuery(
      db.select().from(table as PgTable).where(condition?.where).$dynamic(),
      table,
      condition),
    db.$count(table, condition?.where)
  ]);

  return toPageResult(
    data as InferSelectModel<TTable>[],
    total,
    condition.page!,
  );
}