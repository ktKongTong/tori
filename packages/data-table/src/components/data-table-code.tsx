import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@repo/ui/components/tooltip";
import { cn } from "@repo/ui/lib/utils";

export function DataTableCode({
  value,
  empty = "None",
  copyable = false,
  className,
}: {
  value: string | null | undefined;
  empty?: string;
  copyable?: boolean;
  className?: string;
}) {
  if (!value)
    return <span className={cn("text-sm text-muted-foreground", className)}>{empty}</span>;

  const content = (
    <code
      className={cn(
        "rounded bg-muted/50 px-1.5 py-0.5 font-mono text-xs text-muted-foreground",
        className,
      )}
    >
      {value}
    </code>
  );

  if (!copyable) {
    return content;
  }

  const handleCopy = (e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();
    navigator.clipboard.writeText(value);
    // Ideally use sonner or similar to show a toast, but keeping it simple for now
  };

  return (
    <TooltipProvider delay={150}>
      <Tooltip>
        <TooltipTrigger
          onClick={handleCopy}
          className="focus-visible:outline-none cursor-copy hover:opacity-80 transition-opacity text-left"
        >
          {content}
        </TooltipTrigger>
        <TooltipContent side="top">
          <span className="text-xs">Click to copy</span>
        </TooltipContent>
      </Tooltip>
    </TooltipProvider>
  );
}
