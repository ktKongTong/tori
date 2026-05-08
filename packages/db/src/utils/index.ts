import type { PageBasedPaginationParam, PageResult } from "./type.ts";
export * from "./type.ts";

export const normalizePage = (
  page?: PageBasedPaginationParam,
  options?: {
    defaultPage?: number;
    defaultPageSize?: number;
    maxPageSize?: number;
  },
) => {
  const defaultPage = options?.defaultPage ?? 1;
  const defaultPageSize = options?.defaultPageSize ?? 20;
  const maxPageSize = options?.maxPageSize ?? 100;

  const normalizedPage = Math.max(1, page?.page ?? defaultPage);
  const normalizedPageSize = Math.min(maxPageSize, Math.max(1, page?.pageSize ?? defaultPageSize));

  return {
    page: normalizedPage,
    pageSize: normalizedPageSize,
    limit: normalizedPageSize,
    offset: (normalizedPage - 1) * normalizedPageSize,
  };
};

export const toPageResult = <TData>(
  data: TData[],
  total: number,
  page: PageBasedPaginationParam,
): PageResult<TData> => {
  const normalized = normalizePage(page);
  const totalPages = Math.ceil(total / normalized.pageSize);

  return {
    data,
    page: {
      page: normalized.page,
      pageSize: normalized.pageSize,
      total,
      totalPages,
      hasNextPage: normalized.page < totalPages,
      hasPreviousPage: normalized.page > 1,
    },
  };
};
