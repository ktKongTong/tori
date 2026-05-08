import type { ColumnDef, RowData, TableOptions } from "@tanstack/react-table";
import type { ReactNode } from "react";

export type DataTableColumnKind = "object" | "status" | "health" | "time" | "metadata" | "actions";

export type DataTableDensity = "comfortable" | "compact";

export type DataTableColumnMeta = {
  kind?: DataTableColumnKind;
  priority?: "primary" | "secondary" | "diagnostic";
  align?: "left" | "right" | "center";
  className?: string;
  headerClassName?: string;
};

declare module "@tanstack/react-table" {
  // Enables columnDef.meta to carry dashboard table semantics.
  interface ColumnMeta<TData extends RowData, TValue> extends DataTableColumnMeta {}
}

export type DataTableEmptyState = {
  title: string;
  description?: ReactNode;
  action?: ReactNode;
};

export type DataTableProps<TData> = {
  columns: ColumnDef<TData>[];
  data: TData[];
  empty: DataTableEmptyState | string;
  density?: DataTableDensity;
  getRowId?: TableOptions<TData>["getRowId"];
  className?: string;
  tableClassName?: string;
};

export type DataTableActionItem = {
  key?: string;
  label: string;
  href?: string;
  renderLink?: (children: ReactNode) => ReactNode;
  onSelect?: () => void;
  variant?: "default" | "destructive";
  disabled?: boolean;
};

export type DataTableStatusTone = "neutral" | "success" | "warning" | "danger";

export type DataTableTimeValue = Date | number | string | null | undefined;
