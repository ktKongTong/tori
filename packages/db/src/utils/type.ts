export type SortDirection = "asc" | "desc";

export type PageBasedPaginationParam = {
  page: number;
  pageSize: number;
};

export type DynamicQuery<T extends string> = {
  defaultOrderBy?: {
    column: T;
    direction: SortDirection;
  }[];
  orderBy?: {
    column: T;
    direction: SortDirection;
  }[];
  page?: PageBasedPaginationParam;
};

export type PageResult<T> = {
  data: T[];
  page: {
    page: number;
    pageSize: number;
    total: number;
    totalPages: number;
    hasNextPage: boolean;
    hasPreviousPage: boolean;
  };
};
