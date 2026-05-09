import { Badge } from "@repo/ui/components/badge";
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@repo/ui/components/tooltip";
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

  let variant: "default" | "secondary" | "destructive" = "secondary";
  if (tone === "danger") variant = "destructive";

  const content = (
    <div className="flex items-center">
      <Badge
        variant={variant}
        className={cn(
          tone === "success" && "text-emerald-500",
          tone === "warning" && "text-amber-500",
          tone === "neutral" && "text-muted-foreground",
        )}
      >
        {text}
      </Badge>
    </div>
  );

  if (!detail) {
    return content;
  }

  return (
    <TooltipProvider delay={150}>
      <Tooltip>
        <TooltipTrigger className="focus-visible:outline-none">{content}</TooltipTrigger>
        <TooltipContent side="top">
          <div className="max-w-xs text-sm">{detail}</div>
        </TooltipContent>
      </Tooltip>
    </TooltipProvider>
  );
}
