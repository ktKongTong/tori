import { Alert, AlertDescription, AlertTitle } from "@repo/ui/components/alert";
import { Badge } from "@repo/ui/components/badge";
import { Button } from "@repo/ui/components/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@repo/ui/components/card";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuGroup,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@repo/ui/components/dropdown-menu";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@repo/ui/components/table";
import { cn } from "@repo/ui/lib/utils";
import { Link } from "@tanstack/react-router";
import { type ColumnDef, flexRender, getCoreRowModel, useReactTable } from "@tanstack/react-table";
import { IconDots } from "@tabler/icons-react";
import type { ReactNode } from "react";

export function DashboardPanel({
  eyebrow,
  title,
  description,
  children,
}: {
  eyebrow: string;
  title: string;
  description: string;
  children: ReactNode;
}) {
  return (
    <Card className="gap-0 border border-border/70 py-0 shadow-none ring-0">
      <CardHeader className="gap-2 border-b px-5 py-4">
        <p className="text-xs font-medium tracking-[0.2em] text-muted-foreground uppercase">
          {eyebrow}
        </p>
        <div className="flex flex-col gap-1">
          <CardTitle className="text-xl font-semibold tracking-tight normal-case">
            {title}
          </CardTitle>
          <CardDescription className="max-w-3xl">{description}</CardDescription>
        </div>
      </CardHeader>
      <CardContent className="p-5">{children}</CardContent>
    </Card>
  );
}

export function DashboardActionBar({ children }: { children: ReactNode }) {
  return <div className="flex flex-wrap justify-end gap-3">{children}</div>;
}

export function DashboardStatusPill({
  text,
  tone = "neutral",
}: {
  text: string | null | undefined;
  tone?: "neutral" | "success" | "warning" | "danger";
}) {
  if (!text) return null;

  return (
    <Badge
      variant={tone === "danger" ? "destructive" : "secondary"}
      className={cn(
        "px-2.5 py-1 text-[0.68rem] tracking-[0.16em]",
        tone === "success" && "bg-primary/10 text-primary",
        tone === "warning" && "bg-amber-500/10 text-amber-700 dark:text-amber-300",
        tone === "neutral" && "bg-muted text-muted-foreground",
      )}
    >
      {text}
    </Badge>
  );
}

export function DashboardNotice({
  title,
  children,
  tone = "neutral",
}: {
  title?: string;
  children: ReactNode;
  tone?: "neutral" | "success" | "error";
}) {
  return (
    <Alert
      variant={tone === "error" ? "destructive" : "default"}
      className={cn(
        "border border-border/70 shadow-none after:hidden",
        tone === "success" && "border-primary/30 bg-primary/5",
      )}
    >
      {title ? <AlertTitle>{title}</AlertTitle> : null}
      <AlertDescription>{children}</AlertDescription>
    </Alert>
  );
}

export function DashboardMetric({
  label,
  value,
  detail,
}: {
  label: string;
  value: string;
  detail: string;
}) {
  return (
    <Card className="gap-0 border border-border/70 py-0 shadow-none ring-0">
      <CardContent className="p-4">
        <p className="text-xs font-medium tracking-[0.18em] text-muted-foreground uppercase">
          {label}
        </p>
        <p className="mt-3 text-3xl font-semibold tracking-tight text-foreground">{value}</p>
        <p className="mt-2 text-sm leading-6 text-muted-foreground">{detail}</p>
      </CardContent>
    </Card>
  );
}

export function DashboardResult({ title, value }: { title: string; value: string }) {
  return (
    <Card className="gap-0 border border-border/70 py-0 shadow-none ring-0">
      <CardContent className="p-4">
        <p className="text-xs font-medium tracking-[0.16em] text-muted-foreground uppercase">
          {title}
        </p>
        <pre className="mt-3 overflow-x-auto whitespace-pre-wrap break-words text-sm leading-6 text-foreground">
          {value}
        </pre>
      </CardContent>
    </Card>
  );
}

export function DashboardTable<TData>({
  columns,
  data,
  empty,
}: {
  columns: ColumnDef<TData>[];
  data: TData[];
  empty: string;
}) {
  const table = useReactTable({
    data,
    columns,
    getCoreRowModel: getCoreRowModel(),
    getRowId: (row, index) =>
      typeof row === "object" && row !== null && "id" in row && typeof row.id === "string"
        ? row.id
        : String(index),
  });

  return (
    <div className="overflow-hidden border border-border/70 bg-card">
      <Table>
        <TableHeader className="bg-muted/40">
          {table.getHeaderGroups().map((headerGroup) => (
            <TableRow key={headerGroup.id} className="hover:bg-transparent">
              {headerGroup.headers.map((header) => (
                <TableHead key={header.id} className="px-4 py-3 tracking-[0.16em]">
                  {header.isPlaceholder
                    ? null
                    : flexRender(header.column.columnDef.header, header.getContext())}
                </TableHead>
              ))}
            </TableRow>
          ))}
        </TableHeader>
        <TableBody>
          {table.getRowModel().rows.length ? (
            table.getRowModel().rows.map((row) => (
              <TableRow key={row.id} className="align-top">
                {row.getVisibleCells().map((cell) => (
                  <TableCell key={cell.id} className="px-4 py-3 align-top whitespace-normal">
                    {flexRender(cell.column.columnDef.cell, cell.getContext())}
                  </TableCell>
                ))}
              </TableRow>
            ))
          ) : (
            <TableRow>
              <TableCell
                colSpan={columns.length}
                className="px-4 py-8 text-center text-sm text-muted-foreground"
              >
                {empty}
              </TableCell>
            </TableRow>
          )}
        </TableBody>
      </Table>
    </div>
  );
}

export function DashboardPagination({
  page,
  pageSize,
  total,
  totalPages,
  onPageChange,
}: {
  page: number;
  pageSize: number;
  total: number;
  totalPages: number;
  onPageChange: (page: number) => void;
}) {
  const firstItem = total === 0 ? 0 : (page - 1) * pageSize + 1;
  const lastItem = Math.min(page * pageSize, total);

  return (
    <div className="flex flex-wrap items-center justify-between gap-3 border-x border-b border-border/70 px-4 py-3">
      <p className="text-sm text-muted-foreground">
        {firstItem}-{lastItem} of {total}
      </p>
      <div className="flex items-center gap-2">
        <Button
          variant="outline"
          size="sm"
          disabled={page <= 1}
          onClick={() => onPageChange(page - 1)}
        >
          Previous
        </Button>
        <span className="min-w-24 text-center text-xs font-medium tracking-[0.16em] text-muted-foreground uppercase">
          {page} / {totalPages}
        </span>
        <Button
          variant="outline"
          size="sm"
          disabled={page >= totalPages}
          onClick={() => onPageChange(page + 1)}
        >
          Next
        </Button>
      </div>
    </div>
  );
}

type DashboardTableActionItem = {
  key?: string;
  label: string;
  to?: string;
  onSelect?: () => void;
  variant?: "default" | "destructive";
  disabled?: boolean;
};

export function DashboardTableActions({
  label = "Open actions",
  items,
}: {
  label?: string;
  items: DashboardTableActionItem[];
}) {
  const visibleItems = items.filter((item) => !item.disabled);

  if (!visibleItems.length) return null;

  return (
    <div className="flex justify-end">
      <DropdownMenu>
        <DropdownMenuTrigger render={<Button variant="ghost" size="icon-sm" aria-label={label} />}>
          <IconDots data-icon="inline-start" />
          <span className="sr-only">{label}</span>
        </DropdownMenuTrigger>
        <DropdownMenuContent align="end" className="min-w-40">
          <DropdownMenuGroup>
            {visibleItems.map((item, index) =>
              item.to ? (
                <DropdownMenuItem
                  key={item.key ?? `${item.label}-${index}`}
                  render={<Link to={item.to} />}
                  variant={item.variant}
                >
                  {item.label}
                </DropdownMenuItem>
              ) : (
                <DropdownMenuItem
                  key={item.key ?? `${item.label}-${index}`}
                  onClick={item.onSelect}
                  variant={item.variant}
                >
                  {item.label}
                </DropdownMenuItem>
              ),
            )}
          </DropdownMenuGroup>
        </DropdownMenuContent>
      </DropdownMenu>
    </div>
  );
}
