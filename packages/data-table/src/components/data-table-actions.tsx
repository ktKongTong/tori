import { IconDots } from "@tabler/icons-react";

import { Button } from "@repo/ui/components/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuGroup,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@repo/ui/components/dropdown-menu";

import type { DataTableActionItem } from "../types";

export function DataTableActions({
  label = "Open actions",
  items,
}: {
  label?: string;
  items: DataTableActionItem[];
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
            {visibleItems.map((item, index) => {
              const content = item.renderLink ? item.renderLink(item.label) : item.label;

              if (item.href && !item.renderLink) {
                return (
                  <DropdownMenuItem
                    key={item.key ?? `${item.label}-${index}`}
                    render={<a href={item.href} />}
                    variant={item.variant}
                  >
                    {item.label}
                  </DropdownMenuItem>
                );
              }

              return (
                <DropdownMenuItem
                  key={item.key ?? `${item.label}-${index}`}
                  onClick={item.onSelect}
                  variant={item.variant}
                >
                  {content}
                </DropdownMenuItem>
              );
            })}
          </DropdownMenuGroup>
        </DropdownMenuContent>
      </DropdownMenu>
    </div>
  );
}
