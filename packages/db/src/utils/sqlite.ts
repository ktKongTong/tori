import type {AnySQLiteTable, SQLiteSelect} from "drizzle-orm/sqlite-core";
import {asc, desc, getColumns, type InferSelectModel} from "drizzle-orm";
import type {DynamicQuery, PageBasedPaginationParam} from "./type.ts";

export type TableKey<T extends AnySQLiteTable> =
  Extract<keyof InferSelectModel<T>, string>;

export const dynamicQuery = <
  TQuery extends SQLiteSelect,
  TTable extends AnySQLiteTable,
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

export function withPagination<T extends SQLiteSelect>(
  qb: T, page: PageBasedPaginationParam
) {
  return qb.limit(page.pageSize).offset((page.page - 1) * page.pageSize);
}