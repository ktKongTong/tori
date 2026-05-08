import { flexRender } from "@tanstack/react-table";

import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@repo/ui/components/table";
import { cn } from "@repo/ui/lib/utils";

import { DataTableEmpty } from "./data-table-empty";
import { useDataTable } from "../hooks/use-data-table";
import type { DataTableProps } from "../types";

export function DataTable<TData>({
  columns,
  data,
  empty,
  density = "comfortable",
  getRowId,
  className,
  tableClassName,
}: DataTableProps<TData>) {
  const table = useDataTable({ columns, data, getRowId });
  const cellPadding = density === "compact" ? "px-3 py-2" : "px-4 py-3";

  return (
    <div className={cn("overflow-hidden border border-border/70 bg-card", className)}>
      <Table className={tableClassName}>
        <TableHeader className="bg-muted/40">
          {table.getHeaderGroups().map((headerGroup) => (
            <TableRow key={headerGroup.id} className="hover:bg-transparent">
              {headerGroup.headers.map((header) => {
                const meta = header.column.columnDef.meta;

                return (
                  <TableHead
                    key={header.id}
                    colSpan={header.colSpan}
                    className={cn(
                      cellPadding,
                      "tracking-[0.12em]",
                      meta?.align === "right" && "text-right",
                      meta?.align === "center" && "text-center",
                      meta?.headerClassName,
                    )}
                  >
                    {header.isPlaceholder
                      ? null
                      : flexRender(header.column.columnDef.header, header.getContext())}
                  </TableHead>
                );
              })}
            </TableRow>
          ))}
        </TableHeader>
        <TableBody>
          {table.getRowModel().rows.length ? (
            table.getRowModel().rows.map((row) => (
              <TableRow key={row.id} className="align-top">
                {row.getVisibleCells().map((cell) => {
                  const meta = cell.column.columnDef.meta;

                  return (
                    <TableCell
                      key={cell.id}
                      className={cn(
                        cellPadding,
                        "align-top whitespace-normal",
                        meta?.align === "right" && "text-right",
                        meta?.align === "center" && "text-center",
                        meta?.className,
                      )}
                    >
                      {flexRender(cell.column.columnDef.cell, cell.getContext())}
                    </TableCell>
                  );
                })}
              </TableRow>
            ))
          ) : (
            <TableRow>
              <TableCell colSpan={columns.length} className="px-4 py-8">
                <DataTableEmpty empty={empty} />
              </TableCell>
            </TableRow>
          )}
        </TableBody>
      </Table>
    </div>
  );
}
