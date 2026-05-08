import type { DataTableTimeValue } from "../types";
import { formatDataTableDateTime, formatExactDateTime, formatRelativeTime } from "../lib/time";

export function DataTableTime({
  value,
  empty = "Not recorded",
  mode = "relative",
  locale,
}: {
  value: DataTableTimeValue;
  empty?: string;
  mode?: "relative" | "short";
  locale?: string;
}) {
  const exact = formatExactDateTime(value, locale);
  const display =
    mode === "short" ? formatDataTableDateTime(value, locale) : formatRelativeTime(value, locale);

  if (!display) return <span className="text-sm text-muted-foreground">{empty}</span>;

  return (
    <time
      dateTime={value instanceof Date ? value.toISOString() : String(value)}
      title={exact ?? undefined}
    >
      {display}
    </time>
  );
}
