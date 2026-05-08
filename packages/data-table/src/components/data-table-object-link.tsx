import type { ReactNode } from "react";

import { cn } from "@repo/ui/lib/utils";

export function DataTableObjectLink({
  title,
  description,
  metadata,
  href,
  renderLink,
  onOpen,
  className,
}: {
  title: ReactNode;
  description?: ReactNode;
  metadata?: ReactNode;
  href?: string;
  renderLink?: (children: ReactNode) => ReactNode;
  onOpen?: () => void;
  className?: string;
}) {
  const titleNode = (
    <span className="font-medium text-foreground underline-offset-4 group-hover/object:underline">
      {title}
    </span>
  );
  const interactiveTitle = renderLink ? (
    renderLink(titleNode)
  ) : href ? (
    <a href={href} className="focus-visible:outline-none">
      {titleNode}
    </a>
  ) : onOpen ? (
    <button type="button" onClick={onOpen} className="text-left focus-visible:outline-none">
      {titleNode}
    </button>
  ) : (
    titleNode
  );

  return (
    <div className={cn("group/object min-w-0 space-y-1", className)}>
      <div className="min-w-0">{interactiveTitle}</div>
      {description ? (
        <div className="max-w-xl text-sm leading-5 text-muted-foreground">{description}</div>
      ) : null}
      {metadata ? (
        <div className="flex flex-wrap items-center gap-x-3 gap-y-1 text-xs text-muted-foreground">
          {metadata}
        </div>
      ) : null}
    </div>
  );
}
