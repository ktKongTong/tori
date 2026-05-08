import {
  getCoreRowModel,
  useReactTable,
  type ColumnDef,
  type TableOptions,
} from "@tanstack/react-table";

export function useDataTable<TData>({
  columns,
  data,
  getRowId,
}: {
  columns: ColumnDef<TData>[];
  data: TData[];
  getRowId?: TableOptions<TData>["getRowId"];
}) {
  return useReactTable({
    data,
    columns,
    getCoreRowModel: getCoreRowModel(),
    getRowId:
      getRowId ??
      ((row, index) =>
        typeof row === "object" && row !== null && "id" in row && typeof row.id === "string"
          ? row.id
          : String(index)),
  });
}
