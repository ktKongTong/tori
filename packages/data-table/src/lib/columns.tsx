import type { ColumnDef } from "@tanstack/react-table";
import type { ReactNode } from "react";

import { DataTableActions } from "../components/data-table-actions";
import { DataTableObjectLink } from "../components/data-table-object-link";
import { DataTableStatus } from "../components/data-table-status";
import { DataTableTime } from "../components/data-table-time";
import type { DataTableActionItem, DataTableColumnMeta, DataTableStatusTone } from "../types";

function renderHeader(header: ReactNode) {
  return () => header;
}

export function objectColumn<TData>({
  id = "object",
  header,
  title,
  description,
  metadata,
  href,
  renderLink,
  onOpen,
  meta,
}: {
  id?: string;
  header: ReactNode;
  title: (row: TData) => ReactNode;
  description?: (row: TData) => ReactNode;
  metadata?: (row: TData) => ReactNode;
  href?: (row: TData) => string | undefined;
  renderLink?: (row: TData, children: ReactNode) => ReactNode;
  onOpen?: (row: TData) => void;
  meta?: DataTableColumnMeta;
}): ColumnDef<TData> {
  return {
    id,
    header: renderHeader(header),
    cell: ({ row }) => (
      <DataTableObjectLink
        title={title(row.original)}
        description={description?.(row.original)}
        metadata={metadata?.(row.original)}
        href={href?.(row.original)}
        renderLink={renderLink ? (children) => renderLink(row.original, children) : undefined}
        onOpen={onOpen ? () => onOpen(row.original) : undefined}
      />
    ),
    meta: {
      kind: "object",
      priority: "primary",
      ...meta,
    },
  };
}

export function statusColumn<TData>({
  id = "status",
  header = "Status",
  text,
  tone,
  detail,
  meta,
}: {
  id?: string;
  header?: ReactNode;
  text: (row: TData) => string | null | undefined;
  tone?: (row: TData) => DataTableStatusTone;
  detail?: (row: TData) => string | null | undefined;
  meta?: DataTableColumnMeta;
}): ColumnDef<TData> {
  return {
    id,
    header: renderHeader(header),
    cell: ({ row }) => (
      <DataTableStatus
        text={text(row.original)}
        tone={tone?.(row.original)}
        detail={detail?.(row.original)}
      />
    ),
    meta: {
      kind: "status",
      priority: "secondary",
      ...meta,
    },
  };
}

export function timeColumn<TData>({
  id,
  header,
  value,
  empty,
  mode,
  meta,
}: {
  id: string;
  header: ReactNode;
  value: (row: TData) => Date | number | string | null | undefined;
  empty?: string;
  mode?: "relative" | "short";
  meta?: DataTableColumnMeta;
}): ColumnDef<TData> {
  return {
    id,
    header: renderHeader(header),
    cell: ({ row }) => <DataTableTime value={value(row.original)} empty={empty} mode={mode} />,
    meta: {
      kind: "time",
      priority: "secondary",
      ...meta,
    },
  };
}

export function metadataColumn<TData>({
  id,
  header,
  value,
  meta,
}: {
  id: string;
  header: ReactNode;
  value: (row: TData) => ReactNode;
  meta?: DataTableColumnMeta;
}): ColumnDef<TData> {
  return {
    id,
    header: renderHeader(header),
    cell: ({ row }) => value(row.original),
    meta: {
      kind: "metadata",
      priority: "diagnostic",
      ...meta,
    },
  };
}

export function actionsColumn<TData>({
  id = "actions",
  header = "",
  label,
  items,
  meta,
}: {
  id?: string;
  header?: ReactNode;
  label?: (row: TData) => string;
  items: (row: TData) => DataTableActionItem[];
  meta?: DataTableColumnMeta;
}): ColumnDef<TData> {
  return {
    id,
    header: renderHeader(header),
    cell: ({ row }) => (
      <DataTableActions label={label?.(row.original)} items={items(row.original)} />
    ),
    meta: {
      kind: "actions",
      priority: "secondary",
      align: "right",
      ...meta,
    },
  };
}
