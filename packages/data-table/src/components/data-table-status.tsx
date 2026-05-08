import { Badge } from "@repo/ui/components/badge";
import { cn } from "@repo/ui/lib/utils";

import type { DataTableStatusTone } from "../types";

export function DataTableStatus({
  text,
  tone = "neutral",
  detail,
}: {
  text: string | null | undefined;
  tone?: DataTableStatusTone;
  detail?: string | null;
}) {
  if (!text) return <span className="text-sm text-muted-foreground">Unknown</span>;

  return (
    <div className="space-y-1">
      <Badge
        variant={tone === "danger" ? "destructive" : "secondary"}
        className={cn(
          "px-2.5 py-1 text-[0.68rem] tracking-[0.12em]",
          tone === "success" && "bg-primary/10 text-primary",
          tone === "warning" && "bg-amber-500/10 text-amber-700 dark:text-amber-300",
          tone === "neutral" && "bg-muted text-muted-foreground",
        )}
      >
        {text}
      </Badge>
      {detail ? <p className="max-w-xs text-xs leading-5 text-muted-foreground">{detail}</p> : null}
    </div>
  );
}
