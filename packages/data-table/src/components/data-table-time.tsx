import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@repo/ui/components/tooltip";
import { cn } from "@repo/ui/lib/utils";

import type { DataTableTimeValue } from "../types";
import { formatDataTableDateTime, formatExactDateTime, formatRelativeTime } from "../lib/time";

export function DataTableTime({
  value,
  empty = "Not recorded",
  mode = "relative",
  locale,
  className,
}: {
  value: DataTableTimeValue;
  empty?: string;
  mode?: "relative" | "short";
  locale?: string;
  className?: string;
}) {
  const exact = formatExactDateTime(value, locale);
  const display =
    mode === "short" ? formatDataTableDateTime(value, locale) : formatRelativeTime(value, locale);

  if (!display)
    return <span className={cn("text-sm text-muted-foreground", className)}>{empty}</span>;

  const timeNode = (
    <time
      dateTime={value instanceof Date ? value.toISOString() : String(value)}
      className={cn("text-sm text-foreground", className)}
    >
      {display}
    </time>
  );

  if (!exact) return timeNode;

  return (
    <TooltipProvider delay={150}>
      <Tooltip>
        <TooltipTrigger className="focus-visible:outline-none text-left">{timeNode}</TooltipTrigger>
        <TooltipContent side="top">
          <span className="font-mono text-xs">{exact}</span>
        </TooltipContent>
      </Tooltip>
    </TooltipProvider>
  );
}
