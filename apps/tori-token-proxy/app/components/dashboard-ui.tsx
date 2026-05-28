import { type ReactNode } from "react";

import { Alert, AlertDescription, AlertTitle } from "@repo/ui/components/alert";
import { Badge } from "@repo/ui/components/badge";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@repo/ui/components/card";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@repo/ui/components/table";
import { cn } from "@repo/ui/lib/utils";
import { Button } from "@repo/ui/components/button";

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
        "border px-2.5 py-1 text-[0.68rem] tracking-[0.16em]",
        tone === "success" && "border-primary/20 bg-primary/5 text-foreground",
        tone === "warning" && "border-amber-500/20 bg-amber-500/10 text-amber-700",
        tone === "danger" && "border-destructive/20 bg-destructive/10",
        tone === "neutral" && "border-border/80 bg-muted/40 text-muted-foreground",
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

export function DashboardField({
  label,
  hint,
  children,
}: {
  label: string;
  hint?: string;
  children: ReactNode;
}) {
  return (
    <label className="flex flex-col gap-2">
      <span className="text-xs font-medium tracking-[0.16em] text-muted-foreground uppercase">
        {label}
      </span>
      {children}
      {hint ? <span className="text-xs leading-5 text-muted-foreground">{hint}</span> : null}
    </label>
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

export function DashboardTable({
  columns,
  rows,
  empty,
  rowIds,
}: {
  columns: string[];
  rows: Array<Array<ReactNode>>;
  empty: string;
  rowIds?: string[];
}) {
  return (
    <div className="overflow-hidden border border-border/70 bg-card">
      <Table>
        <TableHeader className="bg-muted/40">
          <TableRow className="hover:bg-transparent">
            {columns.map((column) => (
              <TableHead key={column} className="px-4 py-3 tracking-[0.16em]">
                {column}
              </TableHead>
            ))}
          </TableRow>
        </TableHeader>
        <TableBody>
          {rows.length ? (
            rows.map((row, rowIndex) => (
              <TableRow key={rowIds?.[rowIndex] ?? String(rowIndex)} className="align-top">
                {row.map((cell, cellIndex) => (
                  <TableCell
                    key={`${rowIds?.[rowIndex] ?? rowIndex}-${cellIndex}`}
                    className="px-4 py-3 align-top whitespace-normal"
                  >
                    {cell}
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

export function DashboardLimitPager({
  page,
  pageSize,
  itemCount,
  onPageChange,
}: {
  page: number;
  pageSize: number;
  itemCount: number;
  onPageChange: (page: number) => void;
}) {
  const hasPrevious = page > 1;
  const hasNext = itemCount >= pageSize;
  const firstItem = itemCount === 0 ? 0 : (page - 1) * pageSize + 1;
  const lastItem = (page - 1) * pageSize + itemCount;

  return (
    <div className="flex flex-wrap items-center justify-between gap-3 border-x border-b border-border/70 bg-card px-4 py-3 text-sm text-muted-foreground">
      <span>
        Showing {firstItem}-{lastItem}
      </span>
      <div className="flex items-center gap-2">
        <Button
          type="button"
          variant="outline"
          size="sm"
          disabled={!hasPrevious}
          onClick={() => onPageChange(page - 1)}
        >
          Previous
        </Button>
        <span className="min-w-16 text-center text-xs font-medium tracking-[0.16em] uppercase">
          Page {page}
        </span>
        <Button
          type="button"
          variant="outline"
          size="sm"
          disabled={!hasNext}
          onClick={() => onPageChange(page + 1)}
        >
          Next
        </Button>
      </div>
    </div>
  );
}
