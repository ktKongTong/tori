"use no memo";
import { flexRender } from "@tanstack/react-table";
import { IconAlertTriangle, IconRefresh } from "@tabler/icons-react";

import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@repo/ui/components/table";
import { Button } from "@repo/ui/components/button";
import { Skeleton } from "@repo/ui/components/skeleton";
import { cn } from "@repo/ui/lib/utils";

import { DataTableEmpty } from "./data-table-empty";
import { useDataTable } from "../hooks/use-data-table";
import type { DataTableProps } from "../types";

export function DataTable<TData>({
  columns,
  data,
  empty,
  isLoading,
  error,
  onRetry,
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
          {error ? (
            <TableRow>
              <TableCell colSpan={columns.length} className="px-4 py-12">
                <div className="flex flex-col items-center justify-center text-center">
                  <div className="rounded-full bg-rose-50 p-3 text-rose-500 dark:bg-rose-950/30">
                    <IconAlertTriangle className="size-6" />
                  </div>
                  <h3 className="mt-4 text-base font-semibold text-foreground">
                    Failed to load data
                  </h3>
                  <p className="mt-1 text-sm text-muted-foreground max-w-xs mx-auto">
                    {error.message || "An unexpected error occurred while fetching the registry."}
                  </p>
                  {onRetry && (
                    <Button onClick={onRetry} variant="outline" className="mt-6 gap-2">
                      <IconRefresh className="size-3.5" />
                      Try again
                    </Button>
                  )}
                </div>
              </TableCell>
            </TableRow>
          ) : isLoading ? (
            Array.from({ length: 5 }).map((_, i) => (
              <TableRow key={`skeleton-${i}`}>
                {columns.map((_, j) => (
                  <TableCell key={`skeleton-cell-${j}`} className={cellPadding}>
                    <Skeleton className="h-4 w-full opacity-60" />
                  </TableCell>
                ))}
              </TableRow>
            ))
          ) : table.getRowModel().rows.length ? (
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
