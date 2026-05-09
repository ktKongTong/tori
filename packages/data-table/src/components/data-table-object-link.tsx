import type { ReactNode } from "react";

import { cn } from "@repo/ui/lib/utils";

export function DataTableObjectLink({
  title,
  href,
  renderLink,
  onOpen,
  className,
}: {
  title: ReactNode;
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
    <div className={cn("group/object flex items-center min-w-0", className)}>
      <div className="truncate">{interactiveTitle}</div>
    </div>
  );
}
